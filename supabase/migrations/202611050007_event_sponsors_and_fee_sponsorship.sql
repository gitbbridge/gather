-- Event sponsor records, public recognition, secure fee-sponsorship invitations,
-- capped allocations, and auditable sponsor billing. Sponsor reimbursements are
-- separate from auction proceeds and never change Gather's 5% fee calculation.

create table if not exists public.sponsor_businesses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 160),
  logo_url text,
  website_url text,
  description text not null default '' check (char_length(description) <= 1200),
  contact_name text,
  contact_email text,
  contact_phone text,
  internal_notes text not null default '' check (char_length(internal_notes) <= 4000),
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,business_name)
);

create table if not exists public.sponsorship_tiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  display_rank integer not null default 50,
  display_style text not null default 'compact' check (display_style in ('presenting','prominent','compact')),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auction_id,name)
);

create table if not exists public.event_sponsors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  sponsor_business_id uuid not null references public.sponsor_businesses(id),
  tier_id uuid not null references public.sponsorship_tiers(id),
  commitment_cents integer not null default 0 check (commitment_cents >= 0),
  amount_received_cents integer not null default 0 check (amount_received_cents >= 0),
  public_recognition_enabled boolean not null default true,
  display_order integer not null default 100,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auction_id,sponsor_business_id)
);

create table if not exists public.auction_item_sponsors (
  auction_item_id uuid not null references public.auction_items(id) on delete cascade,
  event_sponsor_id uuid not null references public.event_sponsors(id) on delete cascade,
  recognition_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (auction_item_id,event_sponsor_id)
);

create table if not exists public.fee_sponsorship_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  event_sponsor_id uuid not null references public.event_sponsors(id),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_email text not null,
  requested_coverage text not null check (requested_coverage in ('platform','processing','both')),
  proposed_maximum_cents integer not null check (proposed_maximum_cents > 0),
  coverage_starts_at timestamptz,
  coverage_ends_at timestamptz,
  billing_schedule text not null default 'end_of_event' check (billing_schedule = 'end_of_event'),
  recognition_requested boolean not null default false,
  invitation_message text not null default '' check (char_length(invitation_message) <= 2000),
  status text not null default 'pending' check (status in ('pending','accepted','counteroffered','declined','expired','revoked')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  exchanged_at timestamptz,
  revoked_at timestamptz,
  sent_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coverage_ends_at is null or coverage_starts_at is null or coverage_ends_at > coverage_starts_at)
);

create table if not exists public.sponsor_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.fee_sponsorship_invitations(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_sponsorship_agreements (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.fee_sponsorship_invitations(id),
  organization_id uuid not null references public.organizations(id),
  auction_id uuid not null references public.auctions(id),
  event_sponsor_id uuid not null references public.event_sponsors(id),
  coverage text not null check (coverage in ('platform','processing','both')),
  maximum_cents integer not null check (maximum_cents > 0),
  allocated_cents integer not null default 0 check (allocated_cents >= 0),
  charged_cents integer not null default 0 check (charged_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  billing_schedule text not null default 'end_of_event' check (billing_schedule = 'end_of_event'),
  billing_contact_name text,
  billing_contact_email text,
  status text not null default 'pending_payment_method' check (status in ('pending_organizer_approval','pending_payment_method','active','exhausted','ended','cancelled','payment_failed','disputed')),
  stripe_customer_id text,
  stripe_payment_method_id text,
  stripe_setup_session_id text unique,
  consent_version text not null default 'fee-sponsor-v1',
  consented_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  activated_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (allocated_cents <= maximum_cents),
  check (charged_cents <= allocated_cents)
);

create table if not exists public.fee_sponsorship_recognition (
  auction_id uuid primary key references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  donation_receipts boolean not null default false,
  winning_bid_confirmations boolean not null default false,
  purchase_confirmations boolean not null default false,
  ticket_confirmations boolean not null default false,
  show_sponsor_name boolean not null default true,
  show_sponsor_logo boolean not null default true,
  show_public_event_page boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_sponsorship_allocations (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.fee_sponsorship_agreements(id),
  organization_id uuid not null references public.organizations(id),
  auction_id uuid not null references public.auctions(id),
  invoice_id uuid references public.winner_invoices(id),
  fee_category text not null check (fee_category in ('platform','processing')),
  source_reference text not null,
  eligible_fee_cents integer not null check (eligible_fee_cents >= 0),
  allocated_cents integer not null check (allocated_cents > 0),
  status text not null default 'allocated' check (status in ('allocated','invoiced','collected','reversed','refunded','failed','disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id,fee_category,source_reference)
);

create table if not exists public.sponsor_billing_statements (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.fee_sponsorship_agreements(id),
  organization_id uuid not null references public.organizations(id),
  auction_id uuid not null references public.auctions(id),
  statement_number text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'draft' check (status in ('draft','ready','charging','paid','failed','authentication_required','cancelled','partially_refunded','refunded','disputed')),
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  last_error text,
  issued_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_statement_allocations (
  statement_id uuid not null references public.sponsor_billing_statements(id) on delete cascade,
  allocation_id uuid not null unique references public.fee_sponsorship_allocations(id),
  primary key (statement_id,allocation_id)
);

create table if not exists public.sponsor_payment_events (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.fee_sponsorship_agreements(id),
  statement_id uuid references public.sponsor_billing_statements(id),
  event_type text not null check (event_type in ('authorized','charged','failed','authentication_required','refunded','reversed','disputed','dispute_resolved')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  stripe_reference text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists sponsor_businesses_org_idx on public.sponsor_businesses(organization_id,archived_at,business_name);
create index if not exists sponsorship_tiers_auction_idx on public.sponsorship_tiers(auction_id,display_rank);
create index if not exists event_sponsors_auction_idx on public.event_sponsors(auction_id,status,display_order);
create index if not exists fee_sponsor_invitation_event_idx on public.fee_sponsorship_invitations(auction_id,status,created_at desc);
create index if not exists fee_sponsor_agreement_event_idx on public.fee_sponsorship_agreements(auction_id,status);
create index if not exists fee_sponsor_allocation_agreement_idx on public.fee_sponsorship_allocations(agreement_id,status,created_at);
create index if not exists sponsor_statement_agreement_idx on public.sponsor_billing_statements(agreement_id,created_at desc);

alter table public.sponsor_businesses enable row level security;
alter table public.sponsorship_tiers enable row level security;
alter table public.event_sponsors enable row level security;
alter table public.auction_item_sponsors enable row level security;
alter table public.fee_sponsorship_invitations enable row level security;
alter table public.sponsor_portal_sessions enable row level security;
alter table public.fee_sponsorship_agreements enable row level security;
alter table public.fee_sponsorship_recognition enable row level security;
alter table public.fee_sponsorship_allocations enable row level security;
alter table public.sponsor_billing_statements enable row level security;
alter table public.sponsor_statement_allocations enable row level security;
alter table public.sponsor_payment_events enable row level security;

grant select,insert,update,delete on public.sponsor_businesses,public.sponsorship_tiers,public.event_sponsors,public.auction_item_sponsors,public.fee_sponsorship_recognition to authenticated;
revoke all on public.fee_sponsorship_invitations,public.sponsor_portal_sessions,public.fee_sponsorship_agreements,public.fee_sponsorship_allocations,public.sponsor_billing_statements,public.sponsor_statement_allocations,public.sponsor_payment_events from anon,authenticated;

create policy "organization editors manage sponsor businesses" on public.sponsor_businesses for all to authenticated
  using (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]))
  with check (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy "organization editors manage sponsor tiers" on public.sponsorship_tiers for all to authenticated
  using (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]))
  with check (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy "organization editors manage event sponsors" on public.event_sponsors for all to authenticated
  using (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]))
  with check (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy "organization editors manage item sponsors" on public.auction_item_sponsors for all to authenticated
  using (exists(select 1 from public.event_sponsors es where es.id=event_sponsor_id and private.is_organization_member(es.organization_id,array['owner','admin','editor']::public.organization_role[])))
  with check (exists(select 1 from public.event_sponsors es where es.id=event_sponsor_id and private.is_organization_member(es.organization_id,array['owner','admin','editor']::public.organization_role[])));
create policy "organization editors manage sponsor recognition" on public.fee_sponsorship_recognition for all to authenticated
  using (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]))
  with check (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]));

create or replace function public.prevent_overlapping_fee_sponsorships()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status not in ('pending_payment_method','active','exhausted') then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.auction_id::text,0));
  if exists (
    select 1 from public.fee_sponsorship_agreements existing
    where existing.auction_id=new.auction_id and existing.id<>new.id
      and existing.status in ('pending_payment_method','active','exhausted')
      and (
        new.coverage='both' or existing.coverage='both' or existing.coverage=new.coverage
      )
  ) then raise exception 'An active fee sponsor already covers this event fee category'; end if;
  return new;
end $$;
drop trigger if exists fee_sponsorship_overlap_guard on public.fee_sponsorship_agreements;
create trigger fee_sponsorship_overlap_guard before insert or update of auction_id,coverage,status
  on public.fee_sponsorship_agreements for each row execute procedure public.prevent_overlapping_fee_sponsorships();

create or replace function public.allocate_sponsor_fee(
  target_agreement_id uuid,
  target_invoice_id uuid,
  target_category text,
  target_source_reference text,
  eligible_amount integer
) returns integer language plpgsql security definer set search_path='' as $$
declare agreement_row public.fee_sponsorship_agreements; available integer; allocated integer;
begin
  if target_category not in ('platform','processing') or eligible_amount<=0 then raise exception 'Invalid sponsored fee'; end if;
  select * into agreement_row from public.fee_sponsorship_agreements where id=target_agreement_id for update;
  if agreement_row.id is null or agreement_row.status not in ('active','exhausted') then return 0; end if;
  if target_category='platform' and agreement_row.coverage not in ('platform','both') then return 0; end if;
  if target_category='processing' and agreement_row.coverage not in ('processing','both') then return 0; end if;
  select allocated_cents into allocated from public.fee_sponsorship_allocations
    where agreement_id=target_agreement_id and fee_category=target_category and source_reference=target_source_reference;
  if allocated is not null then return allocated; end if;
  available := greatest(agreement_row.maximum_cents-agreement_row.allocated_cents,0);
  allocated := least(eligible_amount,available);
  if allocated<=0 then
    update public.fee_sponsorship_agreements set status='exhausted',updated_at=now() where id=target_agreement_id;
    return 0;
  end if;
  insert into public.fee_sponsorship_allocations(agreement_id,organization_id,auction_id,invoice_id,fee_category,source_reference,eligible_fee_cents,allocated_cents)
    values(agreement_row.id,agreement_row.organization_id,agreement_row.auction_id,target_invoice_id,target_category,target_source_reference,eligible_amount,allocated);
  update public.fee_sponsorship_agreements set allocated_cents=allocated_cents+allocated,
    status=case when allocated_cents+allocated>=maximum_cents then 'exhausted' else status end,updated_at=now()
    where id=agreement_row.id;
  return allocated;
end $$;

revoke all on function public.allocate_sponsor_fee(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.allocate_sponsor_fee(uuid,uuid,text,text,integer) to service_role;

do $$ begin
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('sponsor-logos','sponsor-logos',true,2097152,array['image/png','image/jpeg','image/webp'])
  on conflict(id) do update set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
exception when undefined_table then null; end $$;

comment on table public.fee_sponsorship_allocations is 'Auditable fee reimbursements only; never counted as auction proceeds.';
comment on column public.fee_sponsorship_agreements.maximum_cents is 'Hard sponsor authorization cap enforced by allocate_sponsor_fee under a row lock.';
