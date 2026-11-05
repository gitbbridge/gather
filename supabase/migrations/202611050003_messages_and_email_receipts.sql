-- Gather Messages and controlled organization email/receipt settings.
-- Messages are durable records. Email is a delivery channel, never the source of truth.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_id uuid references public.auctions(id) on delete set null,
  auction_item_id uuid references public.auction_items(id) on delete set null,
  kind text not null default 'bidder_organizer' check (kind in ('bidder_organizer','support')),
  subject text not null check (char_length(subject) between 1 and 160),
  status text not null default 'open' check (status in ('open','pending','resolved')),
  created_by uuid not null references auth.users(id),
  participant_key text not null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, participant_key)
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('bidder','organizer','support')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('bidder','organizer','support','system')),
  body text not null check (char_length(body) between 1 and 4000),
  message_type text not null default 'user' check (message_type in ('user','system','payment_reminder','fulfillment','ai_escalation')),
  ai_generated boolean not null default false,
  client_request_id text,
  created_at timestamptz not null default now(),
  unique (conversation_id, client_request_id)
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id),
  reason text not null check (reason in ('spam','harassment','fraud','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewed','closed')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auction_id uuid not null references public.auctions(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  audience text not null check (audience in ('all_registered','active_bidders','winners','unpaid_winners')),
  status text not null default 'draft' check (status in ('draft','sending','sent','failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  idempotency_key text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.announcement_recipients (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','skipped')),
  provider_reference text,
  sent_at timestamptz,
  primary key (announcement_id, user_id)
);

create table if not exists public.organization_email_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  show_logo boolean not null default true,
  logo_alignment text not null default 'left' check (logo_alignment in ('left','center')),
  thank_you_heading text not null default 'Thank you for your support' check (char_length(thank_you_heading) <= 120),
  thank_you_message text not null default 'Your generosity makes this work possible.' check (char_length(thank_you_message) <= 600),
  receipt_footer text not null default 'Keep this receipt for your records.' check (char_length(receipt_footer) <= 400),
  reply_to_email text,
  reply_to_verified_at timestamptz,
  pending_reply_to_email text,
  reply_to_verification_hash text,
  reply_to_verification_expires_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.auction_email_overrides (
  auction_id uuid primary key references public.auctions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inherits_defaults boolean not null default true,
  thank_you_heading text check (thank_you_heading is null or char_length(thank_you_heading) <= 120),
  thank_you_message text check (thank_you_message is null or char_length(thank_you_message) <= 600),
  receipt_footer text check (receipt_footer is null or char_length(receipt_footer) <= 400),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_org_recent_idx on public.conversations(organization_id, last_message_at desc);
create index if not exists conversations_auction_recent_idx on public.conversations(auction_id, last_message_at desc);
create index if not exists messages_conversation_recent_idx on public.messages(conversation_id, created_at);
create index if not exists announcements_auction_recent_idx on public.announcements(auction_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.organization_email_settings enable row level security;
alter table public.auction_email_overrides enable row level security;

create or replace function private.is_conversation_participant(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = target_conversation_id and user_id = auth.uid()
  );
$$;

drop policy if exists "participants or organization members read conversations" on public.conversations;
create policy "participants or organization members read conversations" on public.conversations for select to authenticated
using (private.is_organization_member(organization_id) or private.is_conversation_participant(id));

drop policy if exists "participants read conversation participants" on public.conversation_participants;
create policy "participants read conversation participants" on public.conversation_participants for select to authenticated
using (user_id = auth.uid() or exists (
  select 1 from public.conversations c where c.id = conversation_id and private.is_organization_member(c.organization_id)
));

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages for select to authenticated
using (private.is_conversation_participant(messages.conversation_id) or exists (
  select 1 from public.conversations c where c.id = messages.conversation_id and private.is_organization_member(c.organization_id)
));

drop policy if exists "members read announcements" on public.announcements;
create policy "members read announcements" on public.announcements for select to authenticated
using (private.is_organization_member(organization_id) or exists (
  select 1 from public.announcement_recipients r where r.announcement_id = id and r.user_id = auth.uid()
));

drop policy if exists "recipients read announcement delivery" on public.announcement_recipients;
create policy "recipients read announcement delivery" on public.announcement_recipients for select to authenticated
using (user_id = auth.uid());

drop policy if exists "members read organization email settings" on public.organization_email_settings;
create policy "members read organization email settings" on public.organization_email_settings for select to authenticated
using (private.is_organization_member(organization_id));

drop policy if exists "members read auction email overrides" on public.auction_email_overrides;
create policy "members read auction email overrides" on public.auction_email_overrides for select to authenticated
using (private.is_organization_member(organization_id));

comment on table public.messages is 'Durable in-app communication. Email failures never remove these records.';
comment on column public.organization_email_settings.reply_to_verified_at is 'Reply-to may be used only after ownership verification.';
