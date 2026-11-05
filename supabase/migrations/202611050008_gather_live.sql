-- Gather Live: audited live-auction and Fund-a-Need operations.
alter table public.auctions drop constraint if exists auctions_live_session_status_check;
alter table public.auctions add constraint auctions_live_session_status_check
  check (live_session_status in ('not_started','ready','active','paused','ended'));

create table if not exists public.live_event_sessions (
  auction_id uuid primary key references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','ready','active','paused','ended')),
  projector_mode text not null default 'lot' check (projector_mode in ('lot','fund_a_need','thanks')),
  public_message text not null default '',
  version bigint not null default 1,
  started_at timestamptz, started_by uuid references auth.users(id),
  paused_at timestamptz, ended_at timestamptz,
  ended_by uuid references auth.users(id), last_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.live_event_staff (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('event_director','checkin_volunteer','auction_clerk','pledge_recorder','checkout_staff','screen_operator')),
  active boolean not null default true,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (auction_id,user_id,role)
);

create table if not exists public.event_paddles (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  paddle_number integer not null check (paddle_number > 0),
  supporter_id uuid references public.supporters(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  ticket_id uuid references public.event_tickets(id) on delete set null,
  display_name text not null, email text, phone text,
  payment_method_status text not null default 'unknown' check (payment_method_status in ('unknown','not_set','available')),
  status text not null default 'active' check (status in ('active','reassigned','revoked')),
  assigned_by uuid not null references auth.users(id), assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists event_paddles_active_number on public.event_paddles(auction_id,paddle_number) where status='active';

create table if not exists public.paddle_assignment_events (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  paddle_id uuid not null references public.event_paddles(id) on delete cascade,
  event_type text not null check (event_type in ('assigned','reassigned','revoked')),
  prior_paddle_id uuid references public.event_paddles(id),
  actor_id uuid not null references auth.users(id), reason text,
  snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table if not exists public.live_lots (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_item_id uuid not null references public.auction_items(id) on delete cascade,
  lot_number integer not null, run_order integer not null,
  opening_bid_cents integer not null default 0 check (opening_bid_cents >= 0),
  current_bid_cents integer not null default 0 check (current_bid_cents >= 0),
  increment_cents integer not null default 500 check (increment_cents > 0),
  reserve_cents integer check (reserve_cents is null or reserve_cents >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','ready','bidding_open','sold','passed','withdrawn')),
  leading_paddle_id uuid references public.event_paddles(id), winning_paddle_id uuid references public.event_paddles(id),
  version bigint not null default 1, finalized_by uuid references auth.users(id), finalized_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (auction_id,auction_item_id), unique (auction_id,lot_number), unique (auction_id,run_order)
);

create table if not exists public.live_bid_ledger (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions(id) on delete cascade,
  live_lot_id uuid not null references public.live_lots(id) on delete cascade,
  paddle_id uuid references public.event_paddles(id),
  event_type text not null check (event_type in ('bid','correction','void','sold','passed','reopened')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  prior_entry_id uuid references public.live_bid_ledger(id),
  request_id uuid not null, actor_id uuid not null references auth.users(id),
  reason text, origin text not null default 'operator', created_at timestamptz not null default now(),
  unique (auction_id,request_id)
);

create table if not exists public.fund_a_need_appeals (
  id uuid primary key default gen_random_uuid(), auction_id uuid not null unique references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null default 'Fund-a-Need', goal_cents integer check (goal_cents is null or goal_cents >= 0),
  giving_levels_cents integer[] not null default array[10000,25000,50000,100000], allow_custom boolean not null default true,
  active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.fund_a_need_pledges (
  id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.auctions(id) on delete cascade,
  appeal_id uuid not null references public.fund_a_need_appeals(id) on delete cascade,
  paddle_id uuid references public.event_paddles(id), supporter_id uuid references public.supporters(id), user_id uuid references auth.users(id),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pledged' check (status in ('pledged','payment_pending','paid','cancelled','partially_refunded','refunded')),
  request_id uuid not null, payment_reference text, recorded_by uuid not null references auth.users(id),
  reversal_reason text, reversed_by uuid references auth.users(id), reversed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (auction_id,request_id)
);

create table if not exists public.live_event_obligations (
  id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('live_sale','fund_pledge')), source_id uuid not null,
  paddle_id uuid references public.event_paddles(id), payer_user_id uuid references auth.users(id),
  amount_cents integer not null check (amount_cents >= 0), platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  status text not null default 'outstanding' check (status in ('outstanding','checkout_open','paid','cancelled','refunded')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(source_type,source_id)
);

create table if not exists public.live_event_actions (
  id uuid primary key default gen_random_uuid(), auction_id uuid not null references public.auctions(id) on delete cascade,
  action text not null, actor_id uuid not null references auth.users(id), reason text, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.record_live_bid(p_lot_id uuid,p_paddle_id uuid,p_amount_cents integer,p_request_id uuid,p_actor_id uuid)
returns public.live_lots language plpgsql security definer set search_path=public as $$
declare v_lot public.live_lots; v_session public.live_event_sessions; v_prior uuid; v_min integer;
begin
  select * into v_lot from public.live_lots where id=p_lot_id for update;
  if not found then raise exception 'Live lot not found'; end if;
  if exists(select 1 from public.live_bid_ledger where auction_id=v_lot.auction_id and request_id=p_request_id) then return v_lot; end if;
  select * into v_session from public.live_event_sessions where auction_id=v_lot.auction_id;
  if v_session.status <> 'active' or v_lot.status <> 'bidding_open' then raise exception 'Bidding is not open'; end if;
  if not exists(select 1 from public.event_paddles where id=p_paddle_id and auction_id=v_lot.auction_id and status='active') then raise exception 'Paddle is not active'; end if;
  v_min := case when v_lot.current_bid_cents=0 then v_lot.opening_bid_cents else v_lot.current_bid_cents+v_lot.increment_cents end;
  if p_amount_cents < v_min then raise exception 'Bid must be at least %',v_min; end if;
  select id into v_prior from public.live_bid_ledger where live_lot_id=p_lot_id and event_type='bid' order by created_at desc limit 1;
  insert into public.live_bid_ledger(auction_id,live_lot_id,paddle_id,event_type,amount_cents,prior_entry_id,request_id,actor_id) values(v_lot.auction_id,p_lot_id,p_paddle_id,'bid',p_amount_cents,v_prior,p_request_id,p_actor_id);
  update public.live_lots set current_bid_cents=p_amount_cents,leading_paddle_id=p_paddle_id,version=version+1,updated_at=now() where id=p_lot_id returning * into v_lot;
  return v_lot;
end $$;

create or replace function public.finalize_live_lot(p_lot_id uuid,p_outcome text,p_request_id uuid,p_actor_id uuid,p_reason text default null)
returns public.live_lots language plpgsql security definer set search_path=public as $$
declare v_lot public.live_lots; v_paddle public.event_paddles;
begin
  select * into v_lot from public.live_lots where id=p_lot_id for update;
  if not found then raise exception 'Live lot not found'; end if;
  if exists(select 1 from public.live_bid_ledger where auction_id=v_lot.auction_id and request_id=p_request_id) then return v_lot; end if;
  if p_outcome not in ('sold','passed') or v_lot.status <> 'bidding_open' then raise exception 'Lot cannot be finalized'; end if;
  if p_outcome='sold' and (v_lot.leading_paddle_id is null or v_lot.current_bid_cents<=0) then raise exception 'A sold lot requires a winning bid'; end if;
  insert into public.live_bid_ledger(auction_id,live_lot_id,paddle_id,event_type,amount_cents,request_id,actor_id,reason) values(v_lot.auction_id,p_lot_id,v_lot.leading_paddle_id,p_outcome,v_lot.current_bid_cents,p_request_id,p_actor_id,p_reason);
  update public.live_lots set status=p_outcome,winning_paddle_id=case when p_outcome='sold' then leading_paddle_id else null end,finalized_by=p_actor_id,finalized_at=now(),version=version+1,updated_at=now() where id=p_lot_id returning * into v_lot;
  if p_outcome='sold' then
    select * into v_paddle from public.event_paddles where id=v_lot.winning_paddle_id;
    insert into public.live_event_obligations(auction_id,organization_id,source_type,source_id,paddle_id,payer_user_id,amount_cents,platform_fee_cents) values(v_lot.auction_id,v_lot.organization_id,'live_sale',v_lot.id,v_lot.winning_paddle_id,v_paddle.user_id,v_lot.current_bid_cents,round(v_lot.current_bid_cents*.05)) on conflict(source_type,source_id) do nothing;
  end if;
  return v_lot;
end $$;

create or replace function public.record_fund_a_need_pledge(p_appeal_id uuid,p_paddle_id uuid,p_amount_cents integer,p_request_id uuid,p_actor_id uuid)
returns public.fund_a_need_pledges language plpgsql security definer set search_path=public as $$
declare v_appeal public.fund_a_need_appeals; v_paddle public.event_paddles; v_pledge public.fund_a_need_pledges;
begin
  select * into v_appeal from public.fund_a_need_appeals where id=p_appeal_id;
  if not found or not v_appeal.active then raise exception 'Fund-a-Need is not active'; end if;
  if not exists(select 1 from public.live_event_sessions where auction_id=v_appeal.auction_id and status='active') then raise exception 'Live session is not active'; end if;
  select * into v_paddle from public.event_paddles where id=p_paddle_id and auction_id=v_appeal.auction_id and status='active';
  if not found then raise exception 'Paddle is not active'; end if;
  select * into v_pledge from public.fund_a_need_pledges where auction_id=v_appeal.auction_id and request_id=p_request_id;
  if found then return v_pledge; end if;
  insert into public.fund_a_need_pledges(auction_id,appeal_id,paddle_id,supporter_id,user_id,amount_cents,request_id,recorded_by) values(v_appeal.auction_id,v_appeal.id,p_paddle_id,v_paddle.supporter_id,v_paddle.user_id,p_amount_cents,p_request_id,p_actor_id) returning * into v_pledge;
  insert into public.live_event_obligations(auction_id,organization_id,source_type,source_id,paddle_id,payer_user_id,amount_cents,platform_fee_cents) values(v_appeal.auction_id,v_appeal.organization_id,'fund_pledge',v_pledge.id,p_paddle_id,v_paddle.user_id,p_amount_cents,0);
  return v_pledge;
end $$;

revoke all on function public.record_live_bid(uuid,uuid,integer,uuid,uuid) from public;
revoke all on function public.finalize_live_lot(uuid,text,uuid,uuid,text) from public;
revoke all on function public.record_fund_a_need_pledge(uuid,uuid,integer,uuid,uuid) from public;
grant execute on function public.record_live_bid(uuid,uuid,integer,uuid,uuid) to service_role;
grant execute on function public.finalize_live_lot(uuid,text,uuid,uuid,text) to service_role;
grant execute on function public.record_fund_a_need_pledge(uuid,uuid,integer,uuid,uuid) to service_role;

alter table public.live_event_sessions enable row level security;
alter table public.live_event_staff enable row level security;
alter table public.event_paddles enable row level security;
alter table public.paddle_assignment_events enable row level security;
alter table public.live_lots enable row level security;
alter table public.live_bid_ledger enable row level security;
alter table public.fund_a_need_appeals enable row level security;
alter table public.fund_a_need_pledges enable row level security;
alter table public.live_event_obligations enable row level security;
alter table public.live_event_actions enable row level security;

create index if not exists live_lots_queue on public.live_lots(auction_id,run_order);
create index if not exists live_bid_ledger_lot on public.live_bid_ledger(live_lot_id,created_at desc);
create index if not exists fund_pledges_auction on public.fund_a_need_pledges(auction_id,created_at desc);
create index if not exists live_actions_auction on public.live_event_actions(auction_id,created_at desc);
