-- Gather MVP operations: platform administration, catalog, invoices,
-- payments, refunds, pickup, and Give Holidays fulfillment.

do $$ begin
  create type public.invoice_status as enum ('draft', 'open', 'paid', 'partially_refunded', 'refunded', 'void');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.fulfillment_status as enum ('pending', 'ready', 'in_progress', 'fulfilled', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.travel_package_status as enum ('draft', 'available', 'paused', 'retired');
exception when duplicate_object then null; end $$;

create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
revoke all on private.platform_admins from public, anon, authenticated;

create or replace function private.is_platform_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from private.platform_admins
    where user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated;

create table public.organization_homepages (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  draft_version integer not null default 1 check (draft_version > 0),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.auctions
  add column timezone text not null default 'America/Denver',
  add column anti_sniping_enabled boolean not null default true,
  add column extension_window_seconds integer not null default 120 check (extension_window_seconds between 30 and 600),
  add column fee_policy_locked_at timestamptz,
  add column terms_version text not null default 'v1';

create table public.travel_packages (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'give_holidays' check (provider = 'give_holidays'),
  provider_code text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  destination text not null check (char_length(destination) between 2 and 100),
  region text not null check (char_length(region) between 2 and 100),
  title text not null check (char_length(title) between 2 and 140),
  summary text not null default '',
  image_url text,
  wholesale_cost_cents integer not null default 0 check (wholesale_cost_cents >= 0),
  platform_markup_cents integer not null default 0 check (platform_markup_cents >= 0),
  fair_market_value_cents integer not null default 0 check (fair_market_value_cents >= 0),
  suggested_starting_bid_cents integer not null default 0 check (suggested_starting_bid_cents >= 0),
  terms jsonb not null default '{}'::jsonb,
  status public.travel_package_status not null default 'draft',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or status = 'available'),
  check (not is_active or wholesale_cost_cents > 0),
  check (not is_active or fair_market_value_cents > 0)
);
create index travel_packages_active_idx on public.travel_packages(is_active, status);

alter table public.auction_items
  add column travel_package_id uuid references public.travel_packages(id),
  add column travel_package_snapshot jsonb,
  add constraint auction_items_travel_source_check check (
    source <> 'give_holidays'
    or (travel_package_id is not null and travel_package_snapshot is not null)
  ) not valid;
create index auction_items_travel_package_idx on public.auction_items(travel_package_id);

alter table public.bidder_registrations
  add column terms_version text not null default 'v1',
  add column bidder_fee_bps integer not null default 0 check (bidder_fee_bps between 0 and 500),
  add column terms_accepted_at timestamptz not null default now();

create table public.watchlist_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.auction_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index watchlist_entries_item_idx on public.watchlist_entries(item_id);

create table public.winner_invoices (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id),
  payer_id uuid not null references auth.users(id),
  status public.invoice_status not null default 'draft',
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  hammer_subtotal_cents integer not null default 0 check (hammer_subtotal_cents >= 0),
  bidder_platform_fee_cents integer not null default 0 check (bidder_platform_fee_cents >= 0),
  give_holidays_markup_cents integer not null default 0 check (give_holidays_markup_cents >= 0),
  total_due_cents integer not null default 0 check (total_due_cents >= 0),
  processing_fee_cents integer not null default 0 check (processing_fee_cents >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auction_id, payer_id),
  check (total_due_cents = hammer_subtotal_cents + bidder_platform_fee_cents + give_holidays_markup_cents)
);
create index winner_invoices_payer_idx on public.winner_invoices(payer_id, status);
create index winner_invoices_auction_idx on public.winner_invoices(auction_id, status);

create table public.winner_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.winner_invoices(id) on delete cascade,
  auction_item_id uuid not null unique references public.auction_items(id),
  hammer_price_cents integer not null check (hammer_price_cents >= 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  organizer_fee_cents integer not null check (organizer_fee_cents >= 0),
  bidder_fee_cents integer not null check (bidder_fee_cents >= 0),
  give_holidays_markup_cents integer not null default 0 check (give_holidays_markup_cents >= 0),
  created_at timestamptz not null default now(),
  check (organizer_fee_cents + bidder_fee_cents = platform_fee_cents)
);
create index winner_invoice_items_invoice_idx on public.winner_invoice_items(invoice_id);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.winner_invoices(id),
  amount_cents integer not null check (amount_cents > 0),
  reason text,
  stripe_refund_id text unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_refunds_invoice_idx on public.payment_refunds(invoice_id);

create table public.fulfillments (
  id uuid primary key default gen_random_uuid(),
  invoice_item_id uuid not null unique references public.winner_invoice_items(id) on delete cascade,
  fulfillment_type text not null check (fulfillment_type in ('pickup', 'delivery', 'give_holidays')),
  status public.fulfillment_status not null default 'pending',
  pickup_instructions text,
  tracking_reference text,
  provider_reference text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fulfillments_status_idx on public.fulfillments(status, fulfillment_type);

create table public.stripe_webhook_events (
  id text primary key,
  type text not null,
  object_id text,
  connected_account_id text,
  livemode boolean not null,
  status text not null default 'accepted' check (status in ('accepted', 'processing', 'processed', 'failed', 'ignored')),
  stripe_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);
create index stripe_webhook_events_status_idx on public.stripe_webhook_events(status, received_at);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auction_id uuid references public.auctions(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  template text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  provider_reference text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notification_deliveries_queue_idx on public.notification_deliveries(status, scheduled_for);

create trigger organization_homepages_updated_at before update on public.organization_homepages
for each row execute procedure public.set_updated_at();
create trigger travel_packages_updated_at before update on public.travel_packages
for each row execute procedure public.set_updated_at();
create trigger winner_invoices_updated_at before update on public.winner_invoices
for each row execute procedure public.set_updated_at();
create trigger payment_refunds_updated_at before update on public.payment_refunds
for each row execute procedure public.set_updated_at();
create trigger fulfillments_updated_at before update on public.fulfillments
for each row execute procedure public.set_updated_at();

alter table public.organization_homepages enable row level security;
alter table public.travel_packages enable row level security;
alter table public.watchlist_entries enable row level security;
alter table public.winner_invoices enable row level security;
alter table public.winner_invoice_items enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.fulfillments enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.organization_homepages, public.travel_packages, public.watchlist_entries,
  public.winner_invoices, public.winner_invoice_items, public.payment_refunds,
  public.fulfillments, public.stripe_webhook_events, public.notification_deliveries
from anon, authenticated;

grant select on public.organization_homepages to anon, authenticated;
grant insert, update, delete on public.organization_homepages to authenticated;
grant select on public.travel_packages to anon, authenticated;
grant insert, update, delete on public.travel_packages to authenticated;
grant select, insert, delete on public.watchlist_entries to authenticated;
grant select on public.winner_invoices, public.winner_invoice_items, public.payment_refunds, public.fulfillments to authenticated;
grant select on public.notification_deliveries to authenticated;

create policy "Public reads published homepages" on public.organization_homepages
for select to anon using (
  published is not null and exists (
    select 1 from public.organizations o where o.id = organization_id and o.is_public
  )
);
create policy "Members read homepages" on public.organization_homepages
for select to authenticated using (published is not null or private.is_organization_member(organization_id));
create policy "Editors create homepages" on public.organization_homepages
for insert to authenticated with check (private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[]));
create policy "Editors update homepages" on public.organization_homepages
for update to authenticated using (private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[]))
with check (private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[]));
create policy "Admins delete homepages" on public.organization_homepages
for delete to authenticated using (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));

create policy "Public reads active travel packages" on public.travel_packages
for select to anon using (is_active and status = 'available');
create policy "Authenticated reads catalog" on public.travel_packages
for select to authenticated using ((is_active and status = 'available') or private.is_platform_admin());
create policy "Platform admins create packages" on public.travel_packages
for insert to authenticated with check (private.is_platform_admin());
create policy "Platform admins update packages" on public.travel_packages
for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy "Platform admins delete packages" on public.travel_packages
for delete to authenticated using (private.is_platform_admin());

create policy "Users read own watchlist" on public.watchlist_entries
for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add own watchlist" on public.watchlist_entries
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users remove own watchlist" on public.watchlist_entries
for delete to authenticated using (user_id = (select auth.uid()));

create policy "Participants read invoices" on public.winner_invoices
for select to authenticated using (payer_id = (select auth.uid()) or private.can_manage_auction(auction_id));
create policy "Participants read invoice items" on public.winner_invoice_items
for select to authenticated using (exists (
  select 1 from public.winner_invoices i
  where i.id = invoice_id and (i.payer_id = (select auth.uid()) or private.can_manage_auction(i.auction_id))
));
create policy "Participants read refunds" on public.payment_refunds
for select to authenticated using (exists (
  select 1 from public.winner_invoices i
  where i.id = invoice_id and (i.payer_id = (select auth.uid()) or private.can_manage_auction(i.auction_id))
));
create policy "Participants read fulfillment" on public.fulfillments
for select to authenticated using (exists (
  select 1 from public.winner_invoice_items ii
  join public.winner_invoices i on i.id = ii.invoice_id
  where ii.id = invoice_item_id and (i.payer_id = (select auth.uid()) or private.can_manage_auction(i.auction_id))
));
create policy "Users read own notifications" on public.notification_deliveries
for select to authenticated using (user_id = (select auth.uid()) or (auction_id is not null and private.can_manage_auction(auction_id)));

insert into public.travel_packages
  (id, provider_code, slug, destination, region, title, status, is_active)
values
  ('00000000-0000-4000-8000-000000000001', 'CABO', 'cabo-san-lucas', 'Cabo San Lucas', 'Mexico', 'Cabo San Lucas getaway', 'draft', false),
  ('00000000-0000-4000-8000-000000000002', 'CR', 'costa-rica', 'Costa Rica', 'Central America', 'Costa Rica getaway', 'draft', false),
  ('00000000-0000-4000-8000-000000000003', 'TUS', 'tuscany', 'Tuscany', 'Italy', 'Tuscany getaway', 'draft', false),
  ('00000000-0000-4000-8000-000000000004', 'PAR', 'paris', 'Paris', 'France', 'Paris getaway', 'draft', false),
  ('00000000-0000-4000-8000-000000000005', 'MAUI', 'maui', 'Maui', 'Hawaii', 'Maui getaway', 'draft', false),
  ('00000000-0000-4000-8000-000000000006', 'NYC', 'new-york-city', 'New York City', 'New York', 'New York City getaway', 'draft', false)
on conflict (provider_code) do nothing;

