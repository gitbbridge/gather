-- Gather is free for nonprofit organizers. Legacy fee columns remain only for
-- historical compatibility; every new or updated record must store zero.

alter table public.auctions alter column platform_fee_bps set default 0;
alter table public.auctions alter column organizer_fee_share_percent set default 0;
alter table public.auctions drop constraint if exists auctions_platform_fee_bps_check;
alter table public.auctions add constraint auctions_platform_fee_bps_zero check (platform_fee_bps = 0) not valid;

alter table public.winner_invoices
  add column if not exists optional_gather_support_cents integer not null default 0
  check (optional_gather_support_cents >= 0);
alter table public.winner_invoices alter column bidder_platform_fee_cents set default 0;
alter table public.winner_invoices drop constraint if exists winner_invoices_total_due_check;
alter table public.winner_invoices add constraint winner_invoices_total_due_check
  check (total_due_cents = hammer_subtotal_cents + bidder_platform_fee_cents + optional_gather_support_cents);
alter table public.winner_invoices add constraint winner_invoices_new_platform_fee_zero
  check (bidder_platform_fee_cents = 0) not valid;

alter table public.winner_invoice_items alter column platform_fee_cents set default 0;
alter table public.winner_invoice_items alter column organizer_fee_cents set default 0;
alter table public.winner_invoice_items alter column bidder_fee_cents set default 0;
alter table public.winner_invoice_items add constraint winner_invoice_items_new_platform_fees_zero
  check (platform_fee_cents = 0 and organizer_fee_cents = 0 and bidder_fee_cents = 0) not valid;

alter table public.auction_transactions alter column platform_fee_cents set default 0;
alter table public.auction_transactions alter column organizer_fee_cents set default 0;
alter table public.auction_transactions alter column bidder_fee_cents set default 0;
alter table public.auction_transactions add constraint auction_transactions_new_platform_fees_zero
  check (platform_fee_cents = 0 and organizer_fee_cents = 0 and bidder_fee_cents = 0) not valid;

alter table public.live_event_obligations alter column platform_fee_cents set default 0;
alter table public.live_event_obligations add constraint live_event_obligations_new_platform_fee_zero
  check (platform_fee_cents = 0) not valid;

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
    insert into public.live_event_obligations(auction_id,organization_id,source_type,source_id,paddle_id,payer_user_id,amount_cents,platform_fee_cents) values(v_lot.auction_id,v_lot.organization_id,'live_sale',v_lot.id,v_lot.winning_paddle_id,v_paddle.user_id,v_lot.current_bid_cents,0) on conflict(source_type,source_id) do nothing;
  end if;
  return v_lot;
end $$;

comment on column public.winner_invoices.optional_gather_support_cents is
  'Optional supporter contribution to Gather. Defaults to zero and is separate from nonprofit proceeds.';
