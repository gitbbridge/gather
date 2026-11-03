-- Give Holidays controlled catalog, private settlement data, and paid-only claims.
-- Apply after 202611030003_travel_settlement_accounting.sql.

-- Use text statuses so the lifecycle can evolve without enum deployment hazards.
drop policy if exists "Public reads active travel packages" on public.travel_packages;
drop policy if exists "Authenticated reads catalog" on public.travel_packages;
do $$ declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.travel_packages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table public.travel_packages drop constraint %I', constraint_name); end loop;
end $$;

alter table public.travel_packages alter column status drop default;
alter table public.travel_packages alter column status type text using status::text;
update public.travel_packages set status = 'active' where status = 'available';

alter table public.travel_packages
  alter column status set default 'draft',
  add column category text not null default 'Travel',
  add column hero_image_url text,
  add column gallery_urls jsonb not null default '[]'::jsonb,
  add column card_description text not null default '',
  add column full_description text not null default '',
  add column included text not null default '',
  add column not_included text not null default '',
  add column buy_now_price_cents integer check (buy_now_price_cents is null or buy_now_price_cents > 0),
  add column minimum_sale_floor_cents integer not null default 0 check (minimum_sale_floor_cents >= 0),
  add column inventory_total integer not null default 1 check (inventory_total >= 0),
  add column inventory_sold integer not null default 0 check (inventory_sold >= 0),
  add column stay_length text not null default '',
  add column occupancy text not null default '',
  add column room_type text not null default '',
  add column expiration_date date,
  add column booking_lead_time_days integer check (booking_lead_time_days is null or booking_lead_time_days >= 0),
  add column required_traveler_details jsonb not null default '["Traveler names","Preferred dates"]'::jsonb,
  add column cancellation_terms text not null default '',
  add column refund_terms text not null default '',
  add column redemption_instructions text not null default '',
  add column supplier_name text,
  add column supplier_reference text,
  add column internal_notes text,
  add constraint travel_packages_status_check check (status in ('draft','active','paused','sold_out','retired')),
  add constraint travel_packages_inventory_check check (inventory_sold <= inventory_total),
  add constraint travel_packages_active_check check (not is_active or status = 'active'),
  add constraint travel_packages_active_pricing_check check (
    not is_active or (wholesale_cost_cents > 0 and fair_market_value_cents > 0 and inventory_sold < inventory_total)
  );

update public.travel_packages
set hero_image_url = image_url,
    card_description = summary,
    full_description = summary,
    included = coalesce(terms->>'inclusions',''),
    stay_length = coalesce(terms->>'nights',''),
    occupancy = coalesce(terms->>'guests','')
where true;

-- Internal package economics are separated from the bidder-safe item snapshot.
create table public.auction_item_settlements (
  auction_item_id uuid primary key references public.auction_items(id) on delete cascade,
  travel_package_id uuid not null references public.travel_packages(id),
  wholesale_cost_cents integer not null check (wholesale_cost_cents >= 0),
  gather_markup_cents integer not null check (gather_markup_cents >= 0),
  supplier_name text,
  supplier_reference text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger auction_item_settlements_updated_at before update on public.auction_item_settlements
for each row execute procedure public.set_updated_at();
alter table public.auction_item_settlements enable row level security;
revoke all on public.auction_item_settlements from anon, authenticated;

insert into public.auction_item_settlements
  (auction_item_id, travel_package_id, wholesale_cost_cents, gather_markup_cents)
select id, travel_package_id,
  coalesce((travel_package_snapshot->>'wholesaleCostCents')::integer, 0),
  coalesce((travel_package_snapshot->>'platformMarkupCents')::integer, 0)
from public.auction_items
where travel_package_id is not null
on conflict (auction_item_id) do nothing;

update public.auction_items
set travel_package_snapshot = travel_package_snapshot
  - 'wholesaleCostCents' - 'platformMarkupCents' - 'supplierName' - 'supplierReference' - 'internalNotes'
where travel_package_snapshot is not null;

-- The master table is never directly readable by nonprofit or bidder roles.
revoke all on public.travel_packages from anon, authenticated;

create or replace view public.give_holidays_catalog
with (security_barrier = true)
as
select id, slug, destination, region, title, category,
  coalesce(nullif(card_description,''), summary) as card_description,
  coalesce(nullif(full_description,''), summary) as full_description,
  coalesce(hero_image_url, image_url) as hero_image_url,
  gallery_urls, included, not_included, fair_market_value_cents,
  suggested_starting_bid_cents, buy_now_price_cents, minimum_sale_floor_cents,
  inventory_total - inventory_sold as packages_available,
  stay_length, occupancy, room_type, terms, expiration_date,
  booking_lead_time_days, required_traveler_details,
  cancellation_terms, refund_terms, redemption_instructions
from public.travel_packages
where is_active and status = 'active' and inventory_sold < inventory_total;
revoke all on public.give_holidays_catalog from public;
grant select on public.give_holidays_catalog to authenticated;

-- Fulfillment starts only after Stripe confirms the winner invoice is paid.
alter table public.fulfillments alter column status drop default;
alter table public.fulfillments alter column status type text using status::text;
alter table public.fulfillments alter column status set default 'paid_details_needed';
alter table public.fulfillments add constraint fulfillments_status_check check (status in (
  'pending','ready','in_progress','won_unpaid','paid_details_needed','traveler_details_submitted',
  'dates_requested','booking_in_progress','confirmed','fulfilled','cancelled','refunded'
));

-- Remove fulfillment rows the earlier prototype created before payment. Paid
-- rows are preserved and normalized so no completed transaction is lost.
delete from public.fulfillments f
using public.winner_invoice_items ii, public.winner_invoices i
where f.invoice_item_id = ii.id and ii.invoice_id = i.id
  and f.fulfillment_type = 'give_holidays' and i.status <> 'paid';
update public.fulfillments f set status = 'paid_details_needed'
from public.winner_invoice_items ii, public.winner_invoices i
where f.invoice_item_id = ii.id and ii.invoice_id = i.id
  and f.fulfillment_type = 'give_holidays' and i.status = 'paid'
  and f.status in ('pending','ready','in_progress');

with paid_counts as (
  select ai.travel_package_id, count(*)::integer as sold_count
  from public.fulfillments f
  join public.winner_invoice_items ii on ii.id = f.invoice_item_id
  join public.auction_items ai on ai.id = ii.auction_item_id
  where f.fulfillment_type = 'give_holidays' and ai.travel_package_id is not null
  group by ai.travel_package_id
)
update public.travel_packages p
set inventory_sold = greatest(p.inventory_sold, least(p.inventory_total, paid_counts.sold_count)),
    status = case when greatest(p.inventory_sold, paid_counts.sold_count) >= p.inventory_total then 'sold_out' else p.status end,
    is_active = case when greatest(p.inventory_sold, paid_counts.sold_count) >= p.inventory_total then false else p.is_active end
from paid_counts where p.id = paid_counts.travel_package_id;

create table public.traveler_claims (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null unique references public.fulfillments(id) on delete cascade,
  winner_id uuid not null references auth.users(id) on delete cascade,
  traveler_details jsonb not null default '{}'::jsonb,
  preferred_dates jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger traveler_claims_updated_at before update on public.traveler_claims
for each row execute procedure public.set_updated_at();
alter table public.traveler_claims enable row level security;
revoke all on public.traveler_claims from anon, authenticated;
grant select, insert, update on public.traveler_claims to authenticated;
create policy "Winners read own travel claims" on public.traveler_claims
for select to authenticated using (winner_id = (select auth.uid()));
create policy "Winners create own travel claims" on public.traveler_claims
for insert to authenticated with check (winner_id = (select auth.uid()));
create policy "Winners update own travel claims" on public.traveler_claims
for update to authenticated using (winner_id = (select auth.uid())) with check (winner_id = (select auth.uid()));

create or replace function public.activate_paid_fulfillments(target_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare line record; package_updated uuid;
begin
  if not exists (select 1 from public.winner_invoices where id = target_invoice_id and status = 'paid') then
    raise exception 'Invoice must be paid before fulfillment can start';
  end if;
  for line in
    select ii.id as invoice_item_id, ai.source, ai.travel_package_id
    from public.winner_invoice_items ii
    join public.auction_items ai on ai.id = ii.auction_item_id
    where ii.invoice_id = target_invoice_id
  loop
    if not exists (select 1 from public.fulfillments f where f.invoice_item_id = line.invoice_item_id) then
      if line.source = 'give_holidays' then
        package_updated := null;
        update public.travel_packages
        set inventory_sold = inventory_sold + 1,
            status = case when inventory_sold + 1 >= inventory_total then 'sold_out' else status end,
            is_active = case when inventory_sold + 1 >= inventory_total then false else is_active end
        where id = line.travel_package_id and inventory_sold < inventory_total
        returning id into package_updated;
        if package_updated is null then raise exception 'Travel package is sold out'; end if;
        insert into public.fulfillments (invoice_item_id, fulfillment_type, status)
        values (line.invoice_item_id, 'give_holidays', 'paid_details_needed');
      else
        insert into public.fulfillments (invoice_item_id, fulfillment_type, status)
        values (line.invoice_item_id, 'pickup', 'ready');
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.activate_paid_fulfillments(uuid) from public, anon, authenticated;
grant execute on function public.activate_paid_fulfillments(uuid) to service_role;

comment on table public.auction_item_settlements is 'Server-only Give Holidays cost, markup, and supplier data.';
comment on view public.give_holidays_catalog is 'Bidder- and organizer-safe active Give Holidays catalog.';
