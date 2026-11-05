-- Give Holidays Direct Fundraising Offers.
-- This is a distinct transaction class. The direct-offer platform fee defaults
-- to zero and must never inherit the auction commission automatically.

alter table public.travel_packages
  add column if not exists direct_offer_eligible boolean not null default false,
  add column if not exists direct_offer_authorized_quantity integer not null default 0
    check (direct_offer_authorized_quantity >= 0),
  add column if not exists inventory_reserved integer not null default 0 check (inventory_reserved >= 0);
alter table public.travel_packages drop constraint if exists travel_packages_total_inventory_with_reservations;
alter table public.travel_packages add constraint travel_packages_total_inventory_with_reservations check (inventory_sold + inventory_reserved <= inventory_total);

create table if not exists public.direct_offer_fee_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 10000),
  fixed_fee_cents integer not null default 0 check (fixed_fee_cents >= 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.direct_offer_fee_policy(id,enabled,platform_fee_bps,fixed_fee_cents)
values(true,false,0,0) on conflict(id) do nothing;
revoke all on public.direct_offer_fee_policy from anon, authenticated;

create table if not exists public.direct_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  travel_package_id uuid not null references public.travel_packages(id),
  auction_id uuid references public.auctions(id) on delete set null,
  created_by uuid not null references auth.users(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 2 and 160),
  fundraising_message text not null default '' check (char_length(fundraising_message) <= 3000),
  additional_information text not null default '' check (char_length(additional_information) <= 3000),
  hero_image_url text,
  primary_color text not null default '#175b47' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text not null default '#78a68b' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  package_cost_cents integer not null check (package_cost_cents > 0),
  fundraising_amount_cents integer not null check (fundraising_amount_cents > 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  package_snapshot jsonb not null,
  available_quantity integer not null check (available_quantity > 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  expires_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','expired','sold_out','paused','archived')),
  is_public boolean not null default true,
  terms_version text not null default 'direct-offer-v1',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_reserved + quantity_sold <= available_quantity),
  check (unit_price_cents = package_cost_cents + fundraising_amount_cents + platform_fee_cents + tax_cents)
);
create index if not exists direct_offers_org_idx on public.direct_offers(organization_id,created_at desc);
create index if not exists direct_offers_public_idx on public.direct_offers(slug) where status='active' and is_public;

create table if not exists public.direct_offer_orders (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.direct_offers(id),
  organization_id uuid not null references public.organizations(id),
  purchaser_user_id uuid references auth.users(id) on delete set null,
  purchaser_name text not null check (char_length(purchaser_name) between 2 and 120),
  purchaser_email text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price_cents integer not null check (unit_price_cents > 0),
  gross_cents integer not null check (gross_cents > 0),
  package_cost_cents integer not null check (package_cost_cents > 0),
  fundraising_proceeds_cents integer not null check (fundraising_proceeds_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  processing_fee_cents integer not null default 0 check (processing_fee_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  nonprofit_net_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null default 'reserved' check (status in ('reserved','checkout_open','paid','failed','expired','cancelled','partially_refunded','refunded')),
  terms_version text not null,
  offer_snapshot jsonb not null,
  terms_accepted_at timestamptz not null,
  reservation_expires_at timestamptz not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  connected_account_id text,
  receipt_number text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists direct_offer_orders_offer_idx on public.direct_offer_orders(offer_id,created_at desc);
create index if not exists direct_offer_orders_org_idx on public.direct_offer_orders(organization_id,created_at desc);

create table if not exists public.direct_offer_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.direct_offer_orders(id),
  stripe_refund_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null check (status in ('pending','succeeded','failed','cancelled')),
  reason text,
  created_at timestamptz not null default now()
);
revoke all on public.direct_offer_refunds from anon, authenticated;

create table if not exists public.direct_offer_fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.direct_offer_orders(id) on delete cascade,
  offer_id uuid not null references public.direct_offers(id),
  travel_package_id uuid not null references public.travel_packages(id),
  guest_name text not null,
  guest_email text not null,
  status text not null default 'awaiting_concierge_assignment' check (status in (
    'new_purchase','awaiting_concierge_assignment','welcome_sent','guest_contacted','planning_in_progress',
    'awaiting_availability','booking_confirmed','travel_completed','closed','cancelled','refunded'
  )),
  assigned_concierge text,
  outreach_status text,
  last_contact_at timestamptz,
  requested_travel_dates jsonb not null default '[]'::jsonb,
  supplier_confirmation_reference text,
  internal_notes text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supporter_activities add column if not exists direct_offer_order_id uuid references public.direct_offer_orders(id) on delete set null;
alter table public.supporter_activities drop constraint if exists supporter_activities_activity_type_check;
alter table public.supporter_activities add constraint supporter_activities_activity_type_check check (activity_type in (
  'auction_registration','bid_placed','item_won','payment_completed','payment_failed','payment_refunded',
  'payment_partially_refunded','receipt_sent','travel_package_selected','fulfillment_status_changed',
  'internal_note_added','tag_added','tag_removed','historical_contribution',
  'direct_offer_purchased','direct_offer_refunded','direct_offer_fulfillment_status_changed'
));

alter table public.direct_offers enable row level security;
alter table public.direct_offer_orders enable row level security;
alter table public.direct_offer_fulfillments enable row level security;
revoke all on public.direct_offer_orders, public.direct_offer_fulfillments from anon, authenticated;
grant select on public.direct_offers to anon, authenticated;
drop policy if exists "public reads active direct offers" on public.direct_offers;
create policy "public reads active direct offers" on public.direct_offers for select using (
  (status='active' and is_public and (expires_at is null or expires_at > now()))
  or private.is_organization_member(organization_id)
);

create or replace function public.reserve_direct_offer_order(
  target_offer_id uuid, buyer_name text, buyer_email text, purchase_quantity integer,
  buyer_user_id uuid, accepted_terms_version text
) returns uuid language plpgsql security definer set search_path='' as $$
declare offer_row public.direct_offers; package_row public.travel_packages; new_order_id uuid; expired_order record;
begin
  if purchase_quantity < 1 or purchase_quantity > 20 then raise exception 'Invalid quantity'; end if;
  for expired_order in select o.id,o.offer_id,o.quantity,d.travel_package_id from public.direct_offer_orders o join public.direct_offers d on d.id=o.offer_id where o.offer_id=target_offer_id and o.status in ('reserved','checkout_open') and o.reservation_expires_at<=now() for update of o
  loop
    update public.direct_offer_orders set status='expired',updated_at=now() where id=expired_order.id;
    update public.direct_offers set quantity_reserved=greatest(quantity_reserved-expired_order.quantity,0),updated_at=now() where id=expired_order.offer_id;
    update public.travel_packages set inventory_reserved=greatest(inventory_reserved-expired_order.quantity,0) where id=expired_order.travel_package_id;
  end loop;
  select * into offer_row from public.direct_offers where id=target_offer_id for update;
  if offer_row.id is null or offer_row.status <> 'active' or not offer_row.is_public then raise exception 'Offer unavailable'; end if;
  if offer_row.expires_at is not null and offer_row.expires_at <= now() then raise exception 'Offer expired'; end if;
  if offer_row.terms_version <> accepted_terms_version then raise exception 'Offer terms changed'; end if;
  if offer_row.quantity_sold + offer_row.quantity_reserved + purchase_quantity > offer_row.available_quantity then raise exception 'Offer sold out'; end if;
  select * into package_row from public.travel_packages where id=offer_row.travel_package_id for update;
  if package_row.id is null or package_row.status <> 'active' or package_row.inventory_sold + package_row.inventory_reserved + purchase_quantity > package_row.inventory_total then raise exception 'Package sold out'; end if;
  update public.travel_packages set inventory_reserved=inventory_reserved+purchase_quantity where id=package_row.id;
  update public.direct_offers set quantity_reserved=quantity_reserved+purchase_quantity,updated_at=now() where id=offer_row.id;
  insert into public.direct_offer_orders(offer_id,organization_id,purchaser_user_id,purchaser_name,purchaser_email,quantity,unit_price_cents,gross_cents,package_cost_cents,fundraising_proceeds_cents,platform_fee_cents,tax_cents,terms_version,offer_snapshot,terms_accepted_at,reservation_expires_at)
  values(offer_row.id,offer_row.organization_id,buyer_user_id,trim(buyer_name),lower(trim(buyer_email)),purchase_quantity,offer_row.unit_price_cents,offer_row.unit_price_cents*purchase_quantity,offer_row.package_cost_cents*purchase_quantity,offer_row.fundraising_amount_cents*purchase_quantity,offer_row.platform_fee_cents*purchase_quantity,offer_row.tax_cents*purchase_quantity,offer_row.terms_version,jsonb_build_object('title',offer_row.title,'package',offer_row.package_snapshot,'unitPriceCents',offer_row.unit_price_cents,'fundraisingAmountCents',offer_row.fundraising_amount_cents),now(),now()+interval '30 minutes') returning id into new_order_id;
  return new_order_id;
end $$;

create or replace function public.complete_direct_offer_order(target_order_id uuid, checkout_session_id text, payment_intent_id text, charge_id text, processor_fee integer)
returns void language plpgsql security definer set search_path='' as $$
declare order_row public.direct_offer_orders; offer_row public.direct_offers; i integer;
begin
  select * into order_row from public.direct_offer_orders where id=target_order_id for update;
  if order_row.id is null then raise exception 'Order not found'; end if;
  if order_row.status='paid' then return; end if;
  if order_row.stripe_checkout_session_id <> checkout_session_id then raise exception 'Checkout mismatch'; end if;
  if order_row.status not in ('reserved','checkout_open') then raise exception 'Order cannot complete'; end if;
  select * into offer_row from public.direct_offers where id=order_row.offer_id for update;
  update public.direct_offer_orders set status='paid',stripe_payment_intent_id=payment_intent_id,stripe_charge_id=charge_id,processing_fee_cents=greatest(processor_fee,0),nonprofit_net_cents=fundraising_proceeds_cents-greatest(processor_fee,0),receipt_number='GDO-'||upper(substr(id::text,1,8)),paid_at=now(),updated_at=now() where id=order_row.id;
  update public.direct_offers set quantity_reserved=greatest(quantity_reserved-order_row.quantity,0),quantity_sold=quantity_sold+order_row.quantity,status=case when quantity_sold+order_row.quantity>=available_quantity then 'sold_out' else status end,updated_at=now() where id=offer_row.id;
  update public.travel_packages set inventory_reserved=greatest(inventory_reserved-order_row.quantity,0),inventory_sold=inventory_sold+order_row.quantity,status=case when inventory_sold+order_row.quantity>=inventory_total then 'sold_out' else status end,is_active=case when inventory_sold+order_row.quantity>=inventory_total then false else is_active end where id=offer_row.travel_package_id and inventory_sold+order_row.quantity<=inventory_total;
  if not found then raise exception 'Package inventory unavailable'; end if;
  for i in 1..order_row.quantity loop
    insert into public.direct_offer_fulfillments(order_id,offer_id,travel_package_id,guest_name,guest_email,status) values(order_row.id,offer_row.id,offer_row.travel_package_id,order_row.purchaser_name,order_row.purchaser_email,'awaiting_concierge_assignment');
  end loop;
end $$;

create or replace function public.release_direct_offer_order(target_order_id uuid, final_status text)
returns void language plpgsql security definer set search_path='' as $$
declare order_row public.direct_offer_orders; package_id uuid;
begin
 select * into order_row from public.direct_offer_orders where id=target_order_id for update;
 if order_row.id is null or order_row.status='paid' then return; end if;
 select travel_package_id into package_id from public.direct_offers where id=order_row.offer_id;
 update public.direct_offers set quantity_reserved=greatest(quantity_reserved-order_row.quantity,0),updated_at=now() where id=order_row.offer_id;
 update public.travel_packages set inventory_reserved=greatest(inventory_reserved-order_row.quantity,0) where id=package_id;
 update public.direct_offer_orders set status=case when final_status in ('failed','expired','cancelled') then final_status else 'cancelled' end,updated_at=now() where id=order_row.id;
end $$;

revoke all on function public.reserve_direct_offer_order(uuid,text,text,integer,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_direct_offer_order(uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.release_direct_offer_order(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_direct_offer_order(uuid,text,text,integer,uuid,text) to service_role;
grant execute on function public.complete_direct_offer_order(uuid,text,text,text,integer) to service_role;
grant execute on function public.release_direct_offer_order(uuid,text) to service_role;

comment on table public.direct_offers is 'Fixed-price Give Holidays fundraising offers; never inherits auction fee policy.';
comment on table public.direct_offer_orders is 'Immutable direct-offer purchase and financial allocation snapshot.';
