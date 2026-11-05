-- Optional ticket sales, structured ticket designs, inventory-safe checkout,
-- individual admission credentials, and auditable check-in. Ticket fees are
-- deliberately independent from the 5% auction commission and default to $0.

alter table public.auctions
  add column if not exists ticketing_enabled boolean not null default false,
  add column if not exists event_timezone text not null default 'America/Denver';

create table if not exists public.ticket_designs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  config jsonb not null,
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(config) = 'object')
);
create index if not exists ticket_designs_auction_idx on public.ticket_designs(auction_id,updated_at desc);

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  design_id uuid references public.ticket_designs(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  category text not null default 'General Admission',
  benefits text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  capacity integer not null check (capacity > 0),
  admissions_per_unit integer not null default 1 check (admissions_per_unit between 1 and 100),
  maximum_per_order integer not null default 10 check (maximum_per_order between 1 and 100),
  inventory_reserved integer not null default 0 check (inventory_reserved >= 0),
  inventory_sold integer not null default 0 check (inventory_sold >= 0),
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','on_sale','sold_out','closed','cancelled')),
  visibility text not null default 'public' check (visibility in ('public','unlisted','hidden')),
  guest_information_required boolean not null default true,
  show_remaining_inventory boolean not null default false,
  terms_version text not null default 'ticket-v1',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sales_end_at is null or sales_start_at is null or sales_end_at > sales_start_at),
  check (inventory_reserved + inventory_sold <= capacity)
);
create index if not exists ticket_types_auction_idx on public.ticket_types(auction_id,status,created_at);

create table if not exists public.ticket_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  auction_id uuid not null references public.auctions(id),
  purchaser_user_id uuid references auth.users(id) on delete set null,
  purchaser_name text not null check (char_length(purchaser_name) between 2 and 120),
  purchaser_email text not null,
  purchaser_phone text,
  currency text not null default 'usd' check (currency = 'usd'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents = 0),
  processing_fee_cents integer not null default 0 check (processing_fee_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'reserved' check (status in ('reserved','checkout_open','complimentary','paid','failed','expired','cancelled','partially_refunded','refunded')),
  reservation_expires_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  connected_account_id text,
  receipt_number text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_cents = subtotal_cents + tax_cents + platform_fee_cents)
);
create index if not exists ticket_orders_auction_idx on public.ticket_orders(auction_id,created_at desc);
create index if not exists ticket_orders_email_idx on public.ticket_orders(organization_id,lower(purchaser_email));

create table if not exists public.ticket_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticket_orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id),
  quantity integer not null check (quantity between 1 and 100),
  admissions_per_unit integer not null check (admissions_per_unit between 1 and 100),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  ticket_type_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (line_total_cents = quantity * unit_price_cents)
);

create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  auction_id uuid not null references public.auctions(id),
  order_id uuid not null references public.ticket_orders(id),
  order_item_id uuid not null references public.ticket_order_items(id),
  ticket_type_id uuid not null references public.ticket_types(id),
  ticket_number text not null unique,
  secure_token_hash text not null unique,
  attendee_name text,
  attendee_email text,
  design_snapshot jsonb not null,
  status text not null default 'active' check (status in ('active','checked_in','void','cancelled','refunded')),
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists event_tickets_event_idx on public.event_tickets(auction_id,status);
create index if not exists event_tickets_order_idx on public.event_tickets(order_id);

create table if not exists public.ticket_checkin_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.event_tickets(id),
  auction_id uuid not null references public.auctions(id),
  action text not null check (action in ('checked_in','duplicate_scan','reentry','voided')),
  performed_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ticket_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticket_orders(id),
  stripe_refund_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null check (status in ('pending','succeeded','failed','cancelled')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.supporter_activities
  add column if not exists ticket_order_id uuid references public.ticket_orders(id) on delete set null;
alter table public.supporter_activities drop constraint if exists supporter_activities_activity_type_check;
alter table public.supporter_activities add constraint supporter_activities_activity_type_check check (activity_type in (
  'auction_registration','bid_placed','item_won','payment_completed','payment_failed','payment_refunded',
  'payment_partially_refunded','receipt_sent','travel_package_selected','fulfillment_status_changed',
  'internal_note_added','tag_added','tag_removed','historical_contribution','direct_offer_purchased',
  'direct_offer_refunded','direct_offer_fulfillment_status_changed','ticket_purchased','ticket_refunded','event_attended'
));

alter table public.ticket_designs enable row level security;
alter table public.ticket_types enable row level security;
alter table public.ticket_orders enable row level security;
alter table public.ticket_order_items enable row level security;
alter table public.event_tickets enable row level security;
alter table public.ticket_checkin_events enable row level security;
alter table public.ticket_refunds enable row level security;

grant select,insert,update,delete on public.ticket_designs,public.ticket_types to authenticated;
revoke all on public.ticket_orders,public.ticket_order_items,public.event_tickets,public.ticket_checkin_events,public.ticket_refunds from anon,authenticated;

create policy "organization editors manage ticket designs" on public.ticket_designs for all to authenticated
  using (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]))
  with check (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]));
create policy "organization editors manage ticket types" on public.ticket_types for all to authenticated
  using (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]))
  with check (private.is_organization_member(organization_id,array['owner','admin','editor']::public.organization_role[]));

create or replace function public.reserve_ticket_order(
  target_auction_id uuid, buyer_name text, buyer_email text, buyer_phone text,
  buyer_user_id uuid, requested_lines jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  auction_row public.auctions; line jsonb; ticket_row public.ticket_types; expired record;
  new_order_id uuid; subtotal integer := 0; requested_quantity integer;
begin
  select * into auction_row from public.auctions where id=target_auction_id;
  if auction_row.id is null or not auction_row.ticketing_enabled then raise exception 'Ticketing unavailable'; end if;
  if jsonb_typeof(requested_lines) <> 'array' or jsonb_array_length(requested_lines)=0 then raise exception 'No tickets selected'; end if;

  for expired in select id from public.ticket_orders where auction_id=target_auction_id and status in ('reserved','checkout_open') and reservation_expires_at<=now() for update
  loop
    update public.ticket_types tt set inventory_reserved=greatest(tt.inventory_reserved-i.quantity,0),updated_at=now()
      from public.ticket_order_items i where i.order_id=expired.id and i.ticket_type_id=tt.id;
    update public.ticket_orders set status='expired',updated_at=now() where id=expired.id;
  end loop;

  for line in select * from jsonb_array_elements(requested_lines)
  loop
    requested_quantity := (line->>'quantity')::integer;
    select * into ticket_row from public.ticket_types where id=(line->>'ticketTypeId')::uuid and auction_id=target_auction_id for update;
    if ticket_row.id is null or ticket_row.status not in ('scheduled','on_sale') or ticket_row.visibility <> 'public' then raise exception 'Ticket unavailable'; end if;
    if ticket_row.sales_start_at is not null and ticket_row.sales_start_at>now() then raise exception 'Ticket sales have not opened'; end if;
    if ticket_row.sales_end_at is not null and ticket_row.sales_end_at<=now() then raise exception 'Ticket sales have closed'; end if;
    if requested_quantity<1 or requested_quantity>ticket_row.maximum_per_order then raise exception 'Invalid ticket quantity'; end if;
    if ticket_row.inventory_reserved+ticket_row.inventory_sold+requested_quantity>ticket_row.capacity then raise exception 'Ticket sold out'; end if;
    subtotal := subtotal + ticket_row.price_cents*requested_quantity;
  end loop;

  insert into public.ticket_orders(organization_id,auction_id,purchaser_user_id,purchaser_name,purchaser_email,purchaser_phone,subtotal_cents,total_cents,reservation_expires_at)
    values(auction_row.organization_id,auction_row.id,buyer_user_id,trim(buyer_name),lower(trim(buyer_email)),nullif(trim(buyer_phone),''),subtotal,subtotal,now()+interval '20 minutes') returning id into new_order_id;

  for line in select * from jsonb_array_elements(requested_lines)
  loop
    requested_quantity := (line->>'quantity')::integer;
    select * into ticket_row from public.ticket_types where id=(line->>'ticketTypeId')::uuid for update;
    insert into public.ticket_order_items(order_id,ticket_type_id,quantity,admissions_per_unit,unit_price_cents,line_total_cents,ticket_type_snapshot)
      values(new_order_id,ticket_row.id,requested_quantity,ticket_row.admissions_per_unit,ticket_row.price_cents,ticket_row.price_cents*requested_quantity,
        jsonb_build_object('name',ticket_row.name,'description',ticket_row.description,'category',ticket_row.category,'benefits',ticket_row.benefits,'priceCents',ticket_row.price_cents,'termsVersion',ticket_row.terms_version));
    update public.ticket_types set inventory_reserved=inventory_reserved+requested_quantity,updated_at=now() where id=ticket_row.id;
  end loop;
  return new_order_id;
end $$;

create or replace function public.complete_ticket_order(
  target_order_id uuid, checkout_session_id text, payment_intent_id text, charge_id text, processor_fee integer
) returns void language plpgsql security definer set search_path='' as $$
declare order_row public.ticket_orders; item record; design_config jsonb; admission integer;
begin
  select * into order_row from public.ticket_orders where id=target_order_id for update;
  if order_row.id is null then raise exception 'Order not found'; end if;
  if order_row.status='paid' then return; end if;
  if order_row.stripe_checkout_session_id<>checkout_session_id or order_row.status not in ('reserved','checkout_open') then raise exception 'Checkout mismatch'; end if;
  update public.ticket_orders set status=case when subtotal_cents=0 then 'complimentary' else 'paid' end,stripe_payment_intent_id=nullif(payment_intent_id,''),stripe_charge_id=nullif(charge_id,''),processing_fee_cents=greatest(processor_fee,0),receipt_number='GTK-'||upper(substr(id::text,1,8)),paid_at=now(),updated_at=now() where id=order_row.id;
  for item in select oi.*,tt.design_id from public.ticket_order_items oi join public.ticket_types tt on tt.id=oi.ticket_type_id where oi.order_id=order_row.id
  loop
    update public.ticket_types set inventory_reserved=greatest(inventory_reserved-item.quantity,0),inventory_sold=inventory_sold+item.quantity,
      status=case when inventory_sold+item.quantity>=capacity then 'sold_out' else status end,updated_at=now() where id=item.ticket_type_id;
    select config into design_config from public.ticket_designs where id=item.design_id;
    design_config := coalesce(design_config,'{}'::jsonb);
    for admission in 1..(item.quantity*item.admissions_per_unit) loop
      insert into public.event_tickets(organization_id,auction_id,order_id,order_item_id,ticket_type_id,ticket_number,secure_token_hash,attendee_name,attendee_email,design_snapshot)
      values(order_row.organization_id,order_row.auction_id,order_row.id,item.id,item.ticket_type_id,
        'GTK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
        encode(digest(gen_random_uuid()::text||clock_timestamp()::text,'sha256'),'hex'),
        order_row.purchaser_name,order_row.purchaser_email,design_config);
    end loop;
  end loop;
end $$;

create or replace function public.release_ticket_order(target_order_id uuid, final_status text)
returns void language plpgsql security definer set search_path='' as $$
declare order_row public.ticket_orders; item record;
begin
  select * into order_row from public.ticket_orders where id=target_order_id for update;
  if order_row.id is null or order_row.status in ('paid','complimentary','refunded','partially_refunded') then return; end if;
  for item in select * from public.ticket_order_items where order_id=order_row.id loop
    update public.ticket_types set inventory_reserved=greatest(inventory_reserved-item.quantity,0),updated_at=now() where id=item.ticket_type_id;
  end loop;
  update public.ticket_orders set status=case when final_status in ('failed','expired','cancelled') then final_status else 'cancelled' end,updated_at=now() where id=order_row.id;
end $$;

revoke all on function public.reserve_ticket_order(uuid,text,text,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.complete_ticket_order(uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.release_ticket_order(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_ticket_order(uuid,text,text,text,uuid,jsonb) to service_role;
grant execute on function public.complete_ticket_order(uuid,text,text,text,integer) to service_role;
grant execute on function public.release_ticket_order(uuid,text) to service_role;

comment on column public.ticket_orders.platform_fee_cents is 'Independent ticketing fee snapshot. Locked to zero until Gather approves a ticket fee policy.';
comment on table public.event_tickets is 'One secure admission credential per attendee/admission entitlement; never created for an unpaid order.';
