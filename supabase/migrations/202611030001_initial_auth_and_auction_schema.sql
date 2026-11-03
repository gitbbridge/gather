-- Gather Supabase foundation: auth-linked profiles, nonprofit tenancy,
-- auctions, bidding, and fee accounting. Apply in the Supabase SQL editor
-- or with `supabase db push` after linking the project.

create extension if not exists pgcrypto;

do $$ begin
  create type public.organization_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.auction_status as enum ('draft', 'scheduled', 'live', 'closed', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.auction_item_source as enum ('custom', 'give_holidays');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transaction_status as enum ('pending', 'paid', 'refunded', 'failed');
exception when duplicate_object then null; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  legal_name text not null check (char_length(legal_name) between 2 and 160),
  display_name text not null check (char_length(display_name) between 2 and 100),
  headline text not null default 'Good things happen when we give together.',
  mission text not null default '',
  accent_color text not null default '#175b47' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payment-provider and nonprofit-verification details are intentionally kept
-- separate from public organization content. Never store a full EIN here;
-- let the payment provider collect it and retain only status/last-four data.
create table public.organization_private (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  ein_last4 text check (ein_last4 is null or ein_last4 ~ '^[0-9]{4}$'),
  payment_provider_account_id text,
  payments_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members(user_id);

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '',
  status public.auction_status not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  platform_fee_bps integer not null default 500 check (platform_fee_bps = 500),
  organizer_fee_share_percent smallint not null default 100 check (organizer_fee_share_percent between 0 and 100),
  processing_fees_separate boolean not null default true check (processing_fees_separate = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);
create index auctions_organization_id_idx on public.auctions(organization_id);
create index auctions_status_idx on public.auctions(status);

create table public.auction_items (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  source public.auction_item_source not null default 'custom',
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  category text not null default 'Experiences',
  donor_name text,
  image_url text,
  fair_market_value_cents integer check (fair_market_value_cents is null or fair_market_value_cents >= 0),
  starting_bid_cents integer not null default 0 check (starting_bid_cents >= 0),
  bid_increment_cents integer not null default 500 check (bid_increment_cents > 0),
  buy_now_cents integer check (buy_now_cents is null or buy_now_cents > 0),
  give_holidays_package_code text,
  position integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auction_items_auction_id_idx on public.auction_items(auction_id);

create table public.bidder_registrations (
  auction_id uuid not null references public.auctions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  bidder_number bigint generated always as identity,
  created_at timestamptz not null default now(),
  primary key (auction_id, user_id),
  unique (auction_id, bidder_number)
);
create index bidder_registrations_user_id_idx on public.bidder_registrations(user_id);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  item_id uuid not null references public.auction_items(id) on delete cascade,
  bidder_id uuid not null references auth.users(id) on delete cascade,
  maximum_amount_cents integer not null check (maximum_amount_cents > 0),
  created_at timestamptz not null default now()
);
create index bids_item_created_idx on public.bids(item_id, created_at);
create index bids_bidder_id_idx on public.bids(bidder_id);

create table public.auction_transactions (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id),
  item_id uuid references public.auction_items(id),
  payer_id uuid not null references auth.users(id),
  status public.transaction_status not null default 'pending',
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  hammer_price_cents integer not null check (hammer_price_cents >= 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  organizer_fee_cents integer not null check (organizer_fee_cents >= 0),
  bidder_fee_cents integer not null check (bidder_fee_cents >= 0),
  processing_fee_cents integer not null default 0 check (processing_fee_cents >= 0),
  give_holidays_markup_cents integer not null default 0 check (give_holidays_markup_cents >= 0),
  payment_provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (organizer_fee_cents + bidder_fee_cents = platform_fee_cents)
);
create index auction_transactions_auction_id_idx on public.auction_transactions(auction_id);
create index auction_transactions_payer_id_idx on public.auction_transactions(payer_id);

create schema if not exists private;

create or replace function private.is_organization_member(requested_organization_id uuid, allowed_roles public.organization_role[] default null)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = requested_organization_id
      and user_id = (select auth.uid())
      and (allowed_roles is null or role = any(allowed_roles))
  );
$$;

create or replace function private.can_manage_auction(requested_auction_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.auctions a
    where a.id = requested_auction_id
      and private.is_organization_member(a.organization_id, array['owner','admin','editor']::public.organization_role[])
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_organization_member(uuid, public.organization_role[]) from public;
revoke all on function private.can_manage_auction(uuid) from public;
grant execute on function private.is_organization_member(uuid, public.organization_role[]) to authenticated;
grant execute on function private.can_manage_auction(uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.add_organization_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  insert into public.organization_private (organization_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
insert into public.profiles (id, full_name)
select id, nullif(raw_user_meta_data ->> 'full_name', '') from auth.users
on conflict (id) do nothing;
drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created after insert on public.organizations for each row execute procedure public.add_organization_owner();
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations for each row execute procedure public.set_updated_at();
create trigger organization_private_updated_at before update on public.organization_private for each row execute procedure public.set_updated_at();
create trigger auctions_updated_at before update on public.auctions for each row execute procedure public.set_updated_at();
create trigger auction_items_updated_at before update on public.auction_items for each row execute procedure public.set_updated_at();
create trigger auction_transactions_updated_at before update on public.auction_transactions for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_private enable row level security;
alter table public.organization_members enable row level security;
alter table public.auctions enable row level security;
alter table public.auction_items enable row level security;
alter table public.bidder_registrations enable row level security;
alter table public.bids enable row level security;
alter table public.auction_transactions enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.organizations, public.auctions, public.auction_items to anon;
grant select, insert, update, delete on public.organizations, public.organization_members, public.auctions, public.auction_items to authenticated;
grant select, update on public.organization_private to authenticated;
grant select, insert, update on public.bidder_registrations to authenticated;
grant select, insert on public.bids to authenticated;
grant select on public.auction_transactions to authenticated;

create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Public reads public organizations" on public.organizations for select to anon using (is_public);
create policy "Members read organizations" on public.organizations for select to authenticated using (is_public or private.is_organization_member(id));
create policy "Users create organizations" on public.organizations for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "Admins update organizations" on public.organizations for update to authenticated using (private.is_organization_member(id, array['owner','admin']::public.organization_role[])) with check (private.is_organization_member(id, array['owner','admin']::public.organization_role[]));
create policy "Owners delete organizations" on public.organizations for delete to authenticated using (private.is_organization_member(id, array['owner']::public.organization_role[]));

create policy "Admins read private organization data" on public.organization_private for select to authenticated using (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));
create policy "Admins update private organization data" on public.organization_private for update to authenticated using (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[])) with check (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));

create policy "Members read memberships" on public.organization_members for select to authenticated using (user_id = (select auth.uid()) or private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));
create policy "Admins add memberships" on public.organization_members for insert to authenticated with check (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));
create policy "Admins update memberships" on public.organization_members for update to authenticated using (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[])) with check (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));
create policy "Admins delete memberships" on public.organization_members for delete to authenticated using (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));

create policy "Public reads open auctions" on public.auctions for select to anon using (status in ('scheduled','live','closed'));
create policy "Members read auctions" on public.auctions for select to authenticated using (status in ('scheduled','live','closed') or private.is_organization_member(organization_id));
create policy "Editors create auctions" on public.auctions for insert to authenticated with check ((select auth.uid()) = created_by and private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[]));
create policy "Editors update auctions" on public.auctions for update to authenticated using (private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[])) with check (private.is_organization_member(organization_id, array['owner','admin','editor']::public.organization_role[]));
create policy "Admins delete auctions" on public.auctions for delete to authenticated using (private.is_organization_member(organization_id, array['owner','admin']::public.organization_role[]));

create policy "Public reads published items" on public.auction_items for select to anon using (is_published and exists (select 1 from public.auctions a where a.id = auction_id and a.status in ('scheduled','live','closed')));
create policy "Members read auction items" on public.auction_items for select to authenticated using ((is_published and exists (select 1 from public.auctions a where a.id = auction_id and a.status in ('scheduled','live','closed'))) or private.can_manage_auction(auction_id));
create policy "Editors create auction items" on public.auction_items for insert to authenticated with check (private.can_manage_auction(auction_id));
create policy "Editors update auction items" on public.auction_items for update to authenticated using (private.can_manage_auction(auction_id)) with check (private.can_manage_auction(auction_id));
create policy "Editors delete auction items" on public.auction_items for delete to authenticated using (private.can_manage_auction(auction_id));

create policy "Bidders read own registrations" on public.bidder_registrations for select to authenticated using (user_id = (select auth.uid()) or private.can_manage_auction(auction_id));
create policy "Bidders register themselves" on public.bidder_registrations for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Bidders update own registration" on public.bidder_registrations for update to authenticated using (user_id = (select auth.uid()) or private.can_manage_auction(auction_id)) with check (user_id = (select auth.uid()) or private.can_manage_auction(auction_id));

create policy "Bidders read own bids" on public.bids for select to authenticated using (bidder_id = (select auth.uid()) or private.can_manage_auction(auction_id));
create policy "Registered bidders place bids" on public.bids for insert to authenticated with check (
  bidder_id = (select auth.uid())
  and exists (select 1 from public.bidder_registrations r where r.auction_id = bids.auction_id and r.user_id = (select auth.uid()))
  and exists (select 1 from public.auction_items i where i.id = bids.item_id and i.auction_id = bids.auction_id)
  and exists (
    select 1 from public.auctions a
    where a.id = bids.auction_id
      and a.status = 'live'
      and (a.opens_at is null or a.opens_at <= now())
      and (a.closes_at is null or a.closes_at > now())
  )
);

create policy "Participants read transactions" on public.auction_transactions for select to authenticated using (payer_id = (select auth.uid()) or private.can_manage_auction(auction_id));

grant usage, select on all sequences in schema public to authenticated;
