-- Gather MVP expansion: authoritative settlement receipt tracking and
-- organization-scoped supporter history. Apply after 202611030004.

alter type public.invoice_status add value if not exists 'failed';

alter table public.winner_invoices
  add column if not exists last_payment_status text not null default 'not_started'
    check (last_payment_status in ('not_started','pending','paid','failed','partially_refunded','refunded')),
  add column if not exists last_payment_error text,
  add column if not exists stripe_charge_id text unique,
  add column if not exists receipt_number text unique,
  add column if not exists automatic_receipt_sent_at timestamptz,
  add column if not exists last_receipt_sent_at timestamptz,
  add column if not exists receipt_provider_reference text;

alter table public.fulfillments
  add column if not exists status_changed_at timestamptz not null default now();

create unique index if not exists notification_delivery_dedupe_idx
  on public.notification_deliveries(user_id, channel, template);

create table public.supporters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  normalized_email text not null,
  email text not null,
  full_name text not null default '',
  phone text,
  mailing_address jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  record_source text not null check (record_source in (
    'manual','csv_import','auction_registration','bidder_activity','auction_winner','payment','historical_import'
  )),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, normalized_email)
);
create index supporters_organization_activity_idx on public.supporters(organization_id, last_activity_at desc);
create index supporters_organization_user_idx on public.supporters(organization_id, user_id);
create index supporters_tags_idx on public.supporters using gin(tags);

create table public.supporter_activities (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null references public.supporters(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'auction_registration','bid_placed','item_won','payment_completed','payment_failed',
    'payment_refunded','payment_partially_refunded','receipt_sent','travel_package_selected',
    'fulfillment_status_changed','internal_note_added','tag_added','tag_removed','historical_contribution'
  )),
  auction_id uuid references public.auctions(id) on delete set null,
  item_id uuid references public.auction_items(id) on delete set null,
  invoice_id uuid references public.winner_invoices(id) on delete set null,
  fulfillment_id uuid references public.fulfillments(id) on delete set null,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  occurred_at timestamptz not null default now(),
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);
create index supporter_activities_supporter_time_idx on public.supporter_activities(supporter_id, occurred_at desc);
create index supporter_activities_auction_idx on public.supporter_activities(auction_id, activity_type);

create table public.supporter_notes (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null references public.supporters(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index supporter_notes_supporter_time_idx on public.supporter_notes(supporter_id, created_at desc);

create table public.supporter_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  filters jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index supporter_segments_organization_idx on public.supporter_segments(organization_id, name);

create trigger supporters_updated_at before update on public.supporters
for each row execute procedure public.set_updated_at();
create trigger supporter_segments_updated_at before update on public.supporter_segments
for each row execute procedure public.set_updated_at();

alter table public.supporters enable row level security;
alter table public.supporter_activities enable row level security;
alter table public.supporter_notes enable row level security;
alter table public.supporter_segments enable row level security;

revoke all on public.supporters, public.supporter_activities, public.supporter_notes, public.supporter_segments
from anon, authenticated;
grant select, insert, update, delete on public.supporters, public.supporter_activities,
  public.supporter_notes, public.supporter_segments to authenticated;

create policy "Organization members read supporters" on public.supporters
for select to authenticated using (private.is_organization_member(organization_id));
create policy "Organization editors manage supporters" on public.supporters
for all to authenticated using (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
) with check (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
);

create policy "Organization members read supporter activity" on public.supporter_activities
for select to authenticated using (private.is_organization_member(organization_id));
create policy "Organization editors manage supporter activity" on public.supporter_activities
for all to authenticated using (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
) with check (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
);

create policy "Organization members read supporter notes" on public.supporter_notes
for select to authenticated using (private.is_organization_member(organization_id));
create policy "Organization editors manage supporter notes" on public.supporter_notes
for all to authenticated using (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
) with check (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
);

create policy "Organization members read supporter segments" on public.supporter_segments
for select to authenticated using (private.is_organization_member(organization_id));
create policy "Organization editors manage supporter segments" on public.supporter_segments
for all to authenticated using (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
) with check (
  private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])
);

comment on table public.supporters is 'One organization-scoped supporter identity, matched automatically by normalized email.';
comment on table public.supporter_activities is 'Auction, payment, receipt, fulfillment, note, tag, and imported-history activity.';
comment on column public.supporter_activities.amount_cents is 'Context-specific amount; historical contributions remain separate from confirmed Gather payments.';
