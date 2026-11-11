-- Gather Security Hardening: defense-in-depth for live-event financial records.
-- All access to these records is mediated by authenticated server routes.
revoke all on public.live_event_sessions, public.live_event_staff,
  public.event_paddles, public.paddle_assignment_events, public.live_lots,
  public.live_bid_ledger, public.fund_a_need_appeals,
  public.fund_a_need_pledges, public.live_event_obligations,
  public.live_event_actions from anon, authenticated;

revoke all on function public.record_live_bid(uuid,uuid,integer,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_live_lot(uuid,text,uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.record_fund_a_need_pledge(uuid,uuid,integer,uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.record_live_bid(uuid,uuid,integer,uuid,uuid)
  to service_role;
grant execute on function public.finalize_live_lot(uuid,text,uuid,uuid,text)
  to service_role;
grant execute on function public.record_fund_a_need_pledge(uuid,uuid,integer,uuid,uuid)
  to service_role;

alter function public.record_live_bid(uuid,uuid,integer,uuid,uuid)
  set search_path = '';
alter function public.finalize_live_lot(uuid,text,uuid,uuid,text)
  set search_path = '';
alter function public.record_fund_a_need_pledge(uuid,uuid,integer,uuid,uuid)
  set search_path = '';

comment on table public.live_bid_ledger is
  'Server-only append-only ledger. Direct browser roles have no grants.';
comment on table public.live_event_obligations is
  'Server-only financial obligations. Fund-a-Need pledges retain zero platform fee.';

