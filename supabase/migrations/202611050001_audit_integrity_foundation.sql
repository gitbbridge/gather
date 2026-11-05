-- Gather records-integrity foundation.
-- This provides append-only, hash-linked records inside Supabase. It is
-- tamper-evident, but must not be described as independently immutable until
-- retention-locked archival and external checkpoints are configured.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default clock_timestamp(),
  organization_id uuid references public.organizations(id),
  auction_id uuid references public.auctions(id),
  record_id text not null,
  record_type text not null check (char_length(record_type) between 1 and 80),
  action text not null check (char_length(action) between 1 and 80),
  actor_id uuid references auth.users(id) on delete set null,
  actor_identifier text not null,
  actor_role text not null,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  authorization_reference text,
  source_system text not null,
  correlation_id text not null,
  previous_integrity_hash text,
  integrity_hash text not null unique,
  check (integrity_hash ~ '^[a-f0-9]{64}$'),
  check (previous_integrity_hash is null or previous_integrity_hash ~ '^[a-f0-9]{64}$')
);
create index audit_events_auction_time_idx on public.audit_events(auction_id, occurred_at desc);
create index audit_events_organization_time_idx on public.audit_events(organization_id, occurred_at desc);
create index audit_events_record_idx on public.audit_events(record_type, record_id, occurred_at desc);
create index audit_events_correlation_idx on public.audit_events(correlation_id);

create table public.auction_item_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  auction_id uuid not null references public.auctions(id),
  auction_item_id uuid not null references public.auction_items(id),
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  change_reason text,
  audit_event_id uuid not null unique references public.audit_events(id),
  created_at timestamptz not null default clock_timestamp(),
  unique (auction_item_id, version_number)
);
create index auction_item_versions_auction_idx on public.auction_item_versions(auction_id, created_at desc);

create or replace function private.reject_committed_record_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Committed records are append-only. Create a correction event instead.';
end;
$$;

create trigger audit_events_reject_update_delete
before update or delete on public.audit_events
for each row execute procedure private.reject_committed_record_change();

create trigger auction_item_versions_reject_update_delete
before update or delete on public.auction_item_versions
for each row execute procedure private.reject_committed_record_change();

create or replace function private.append_audit_event(
  requested_organization_id uuid,
  requested_auction_id uuid,
  requested_record_id text,
  requested_record_type text,
  requested_action text,
  requested_actor_id uuid,
  requested_actor_identifier text,
  requested_actor_role text,
  requested_previous_state jsonb,
  requested_new_state jsonb,
  requested_reason text,
  requested_authorization_reference text,
  requested_source_system text,
  requested_correlation_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid := gen_random_uuid();
  created_timestamp timestamptz := clock_timestamp();
  prior_hash text;
  created_hash text;
  canonical_event jsonb;
begin
  -- Serialize each organization's chain. This prevents concurrent writes from
  -- selecting the same predecessor and silently forking the history.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(requested_organization_id::text, 'platform'), 0));

  select integrity_hash into prior_hash
  from public.audit_events
  where organization_id is not distinct from requested_organization_id
  order by occurred_at desc, id desc
  limit 1;

  canonical_event := jsonb_build_object(
    'id', created_id,
    'occurredAt', created_timestamp,
    'organizationId', requested_organization_id,
    'auctionId', requested_auction_id,
    'recordId', requested_record_id,
    'recordType', requested_record_type,
    'action', requested_action,
    'actorId', requested_actor_id,
    'actorIdentifier', requested_actor_identifier,
    'actorRole', requested_actor_role,
    'previousState', requested_previous_state,
    'newState', requested_new_state,
    'reason', requested_reason,
    'authorizationReference', requested_authorization_reference,
    'sourceSystem', requested_source_system,
    'correlationId', requested_correlation_id,
    'previousIntegrityHash', prior_hash
  );
  created_hash := encode(digest(convert_to(canonical_event::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.audit_events (
    id, occurred_at, organization_id, auction_id, record_id, record_type, action,
    actor_id, actor_identifier, actor_role, previous_state, new_state, reason,
    authorization_reference, source_system, correlation_id,
    previous_integrity_hash, integrity_hash
  ) values (
    created_id, created_timestamp, requested_organization_id, requested_auction_id,
    requested_record_id, requested_record_type, requested_action, requested_actor_id,
    requested_actor_identifier, requested_actor_role, requested_previous_state,
    requested_new_state, requested_reason, requested_authorization_reference,
    requested_source_system, requested_correlation_id, prior_hash, created_hash
  );
  return created_id;
end;
$$;

create or replace function private.audit_auction_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  related_organization_id uuid;
  created_audit_id uuid;
  next_version integer;
begin
  select organization_id into related_organization_id from public.auctions where id = new.auction_id;
  created_audit_id := private.append_audit_event(
    related_organization_id, new.auction_id, new.id::text, 'auction_item',
    case when tg_op = 'INSERT' then 'created' else 'changed' end,
    auth.uid(), coalesce(auth.uid()::text, 'gather-service'),
    case when auth.uid() is null then 'service' else 'authenticated' end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new), null, null, 'supabase', gen_random_uuid()::text
  );
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.auction_item_versions where auction_item_id = new.id;
  insert into public.auction_item_versions (
    organization_id, auction_id, auction_item_id, version_number, snapshot, audit_event_id
  ) values (
    related_organization_id, new.auction_id, new.id, next_version, to_jsonb(new), created_audit_id
  );
  return new;
end;
$$;

create trigger auction_items_audit_version
after insert or update on public.auction_items
for each row execute procedure private.audit_auction_item_change();

alter table public.audit_events enable row level security;
alter table public.auction_item_versions enable row level security;
revoke all on public.audit_events, public.auction_item_versions from anon, authenticated;
grant select on public.audit_events, public.auction_item_versions to authenticated;

create policy "Organization members read audit history" on public.audit_events
for select to authenticated using (
  organization_id is not null and private.is_organization_member(organization_id)
);
create policy "Organization members read item versions" on public.auction_item_versions
for select to authenticated using (private.is_organization_member(organization_id));

revoke all on function private.append_audit_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, jsonb, text, text, text, text
) from public, anon, authenticated;
grant execute on function private.append_audit_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, jsonb, text, text, text, text
) to service_role;

comment on table public.audit_events is
  'Append-only, hash-linked audit history. Tamper-evident; independent retention-locked archival is a separate deployment requirement.';
comment on table public.auction_item_versions is
  'Immutable snapshots preserving the terms represented as auction items change.';
