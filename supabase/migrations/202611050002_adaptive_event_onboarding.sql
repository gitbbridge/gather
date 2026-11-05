-- Adaptive event onboarding. Existing auctions remain online silent auctions.
-- Publishing live/hybrid event information does not start a live session.

do $$ begin
  create type public.event_type as enum ('online_silent', 'live', 'hybrid');
exception when duplicate_object then null; end $$;

alter table public.auctions
  add column if not exists event_type public.event_type not null default 'online_silent',
  add column if not exists event_starts_at timestamptz,
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists planning_notes text,
  add column if not exists planned_capabilities jsonb not null default '{"liveAuction":false,"silentAuction":true,"donationAppeal":false}'::jsonb,
  add column if not exists live_session_status text not null default 'not_started'
    check (live_session_status in ('not_started','ready','active','ended'));

alter table public.auctions
  add constraint live_events_require_date_and_venue check (
    event_type = 'online_silent' or (event_starts_at is not null and nullif(trim(venue_name), '') is not null)
  ) not valid;

comment on column public.auctions.event_type is 'Organizer-selected event format. Existing auctions default to online_silent.';
comment on column public.auctions.planned_capabilities is 'Planning intent only; it does not activate ticketing, live bidding, check-in, or Fund-a-Need.';
comment on column public.auctions.live_session_status is 'Controlled by the future Gather Live module; onboarding always creates not_started.';
