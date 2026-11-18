-- Organization-scoped Email Marketing records. CRM supporters remain the
-- single contact source of truth; these tables store consent, campaigns,
-- delivery activity, templates, sending identities, and automations.

create table public.marketing_contact_preferences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supporter_id uuid not null references public.supporters(id) on delete cascade,
  marketing_status text not null default 'unknown' check (marketing_status in ('unknown','subscribed','unsubscribed','complained')),
  consent_source text,
  consent_recorded_at timestamptz,
  validation_provider text,
  validation_status text not null default 'not_checked' check (validation_status in ('not_checked','deliverable','risky','unknown','undeliverable')),
  validation_diagnostics jsonb not null default '{}'::jsonb,
  validated_at timestamptz,
  suppression_reason text,
  suppressed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, supporter_id)
);

create table public.email_sending_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  from_email text not null,
  reply_to_email text not null,
  domain_name text not null,
  ownership_mode text not null default 'existing' check (ownership_mode in ('existing','gather_managed')),
  mailbox_mode text not null default 'forwarding' check (mailbox_mode in ('mailbox','forwarding','mailbox_and_forwarding')),
  status text not null default 'pending' check (status in ('pending','dns_required','verifying','verified','restricted')),
  provider_reference text,
  authentication_records jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, from_email)
);

create table public.email_audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  rule_match text not null default 'and' check (rule_match in ('and','or')),
  rules jsonb not null default '[]'::jsonb,
  last_eligible_count integer not null default 0 check (last_eligible_count >= 0),
  last_calculated_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  category text not null,
  description text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audience_id uuid references public.email_audiences(id) on delete set null,
  sending_identity_id uuid references public.email_sending_identities(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  internal_name text not null check (char_length(internal_name) between 2 and 140),
  subject text not null default '',
  preview_text text not null default '',
  status text not null default 'draft' check (status in ('draft','scheduled','sending','paused','completed','cancelled','failed')),
  blocks jsonb not null default '[]'::jsonb,
  rendered_html text not null default '',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  intended_count integer not null default 0,
  attempted_count integer not null default 0,
  accepted_count integer not null default 0,
  delivered_count integer not null default 0,
  failure_count integer not null default 0,
  bounce_count integer not null default 0,
  complaint_count integer not null default 0,
  unsubscribe_count integer not null default 0,
  open_count integer not null default 0,
  click_count integer not null default 0,
  attributed_opportunity_count integer not null default 0,
  attributed_amount_cents integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_campaign_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  supporter_id uuid references public.supporters(id) on delete set null,
  event_type text not null check (event_type in ('intended','attempted','accepted','delivered','delivery_failed','bounce','complaint','unsubscribe','open','click','conversion')),
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index email_campaign_events_provider_unique on public.email_campaign_events(provider_event_id) where provider_event_id is not null;

create table public.email_automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete set null,
  audience_id uuid references public.email_audiences(id) on delete set null,
  name text not null,
  workflow_type text not null check (workflow_type in ('event_invitation','registration_reminder','auction_preview','auction_opening','event_reminder','post_event_followup','thank_you')),
  trigger_config jsonb not null default '{}'::jsonb,
  delay_minutes integer not null default 0 check (delay_minutes >= 0),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid not null references public.email_automations(id) on delete cascade,
  supporter_id uuid references public.supporters(id) on delete set null,
  status text not null check (status in ('queued','skipped','sent','failed')),
  reason text,
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_provider_webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.email_campaign_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

insert into public.email_templates (id,name,category,description,blocks,is_system) values
('10000000-0000-4000-8000-000000000001','Save the Date','Event invitations','Announce an upcoming fundraiser and invite supporters to save the date.',
 '[{"id":"heading","type":"heading","content":"Save the date"},{"id":"text","type":"text","content":"Something meaningful is coming. Join us for our next fundraiser and help move our mission forward."},{"id":"button","type":"button","content":"View event details","href":"https://gatherforgood.bid"}]'::jsonb,true),
('10000000-0000-4000-8000-000000000002','Auction Preview','Auctions','Build anticipation by previewing the items and experiences supporters can bid on.',
 '[{"id":"heading","type":"heading","content":"A first look at what is up for bid"},{"id":"text","type":"text","content":"Explore standout auction items, invite a friend, and get ready to bid for a cause you care about."},{"id":"button","type":"button","content":"Preview the auction","href":"https://gatherforgood.bid"}]'::jsonb,true),
('10000000-0000-4000-8000-000000000003','Auction Is Open','Auctions','Tell eligible supporters that bidding has opened.',
 '[{"id":"heading","type":"heading","content":"Bidding is now open"},{"id":"text","type":"text","content":"Your bids support our work. Browse the catalog, choose your favorites, and bid with purpose."},{"id":"button","type":"button","content":"Start bidding","href":"https://gatherforgood.bid"}]'::jsonb,true),
('10000000-0000-4000-8000-000000000004','Event Reminder','Event reminders','Share the important date, time, and arrival details before an event.',
 '[{"id":"heading","type":"heading","content":"We look forward to seeing you"},{"id":"text","type":"text","content":"Your fundraiser is almost here. Review the event details so you arrive ready to take part."},{"id":"button","type":"button","content":"Review event details","href":"https://gatherforgood.bid"}]'::jsonb,true),
('10000000-0000-4000-8000-000000000005','Last Chance to Bid','Auctions','Remind supporters that online bidding is about to close.',
 '[{"id":"heading","type":"heading","content":"Last chance to bid"},{"id":"text","type":"text","content":"The auction closes soon. Return to your watchlist and make your final bids before time runs out."},{"id":"button","type":"button","content":"Return to the auction","href":"https://gatherforgood.bid"}]'::jsonb,true),
('10000000-0000-4000-8000-000000000006','Thank You','Stewardship','Thank supporters after a fundraiser and explain the difference they made.',
 '[{"id":"heading","type":"heading","content":"Thank you for showing up"},{"id":"text","type":"text","content":"Your generosity made this fundraiser possible. We are grateful to have you as part of this community."}]'::jsonb,true),
('10000000-0000-4000-8000-000000000007','Travel Experiences Are Here','Give Holidays','Introduce optional Give Holidays travel experiences without implying they are required.',
 '[{"id":"heading","type":"heading","content":"Exceptional travel experiences are here"},{"id":"text","type":"text","content":"Explore curated Give Holidays experiences available in our auction. Package terms and restrictions are shown before you bid."},{"id":"button","type":"button","content":"View travel experiences","href":"https://gatherforgood.bid/about/give-holidays"}]'::jsonb,true),
('10000000-0000-4000-8000-000000000008','General Fundraising Update','Campaign updates','Share a clear progress update and invite supporters to stay involved.',
 '[{"id":"heading","type":"heading","content":"Here is what your support is making possible"},{"id":"text","type":"text","content":"We are making progress together. Thank you for following our work and helping us reach more people."},{"id":"button","type":"button","content":"See the latest update","href":"https://gatherforgood.bid"}]'::jsonb,true)
on conflict (id) do nothing;

create index email_campaigns_org_status_idx on public.email_campaigns(organization_id,status,updated_at desc);
create index email_audiences_org_idx on public.email_audiences(organization_id,updated_at desc);
create index email_templates_org_idx on public.email_templates(organization_id,updated_at desc);
create index email_events_campaign_time_idx on public.email_campaign_events(campaign_id,occurred_at desc);
create index email_automations_org_idx on public.email_automations(organization_id,status);
create index marketing_preferences_org_status_idx on public.marketing_contact_preferences(organization_id,marketing_status,validation_status);

create trigger marketing_contact_preferences_updated_at before update on public.marketing_contact_preferences for each row execute procedure public.set_updated_at();
create trigger email_sending_identities_updated_at before update on public.email_sending_identities for each row execute procedure public.set_updated_at();
create trigger email_audiences_updated_at before update on public.email_audiences for each row execute procedure public.set_updated_at();
create trigger email_templates_updated_at before update on public.email_templates for each row execute procedure public.set_updated_at();
create trigger email_campaigns_updated_at before update on public.email_campaigns for each row execute procedure public.set_updated_at();
create trigger email_automations_updated_at before update on public.email_automations for each row execute procedure public.set_updated_at();

alter table public.marketing_contact_preferences enable row level security;
alter table public.email_sending_identities enable row level security;
alter table public.email_audiences enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_events enable row level security;
alter table public.email_automations enable row level security;
alter table public.email_automation_runs enable row level security;
alter table public.email_provider_webhook_events enable row level security;
alter table public.email_campaign_audit_events enable row level security;

revoke all on public.email_provider_webhook_events from anon, authenticated;

do $$ declare table_name text;
begin
  foreach table_name in array array['marketing_contact_preferences','email_sending_identities','email_audiences','email_templates','email_campaigns','email_campaign_events','email_automations','email_automation_runs','email_campaign_audit_events']
  loop
    execute format('create policy "Organization members read %1$s" on public.%1$I for select to authenticated using (private.is_organization_member(organization_id))', table_name);
    execute format('create policy "Organization editors manage %1$s" on public.%1$I for all to authenticated using (private.is_organization_member(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[])) with check (private.is_organization_member(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[]))', table_name);
  end loop;
end $$;

create policy "Authenticated users read system email templates" on public.email_templates
for select to authenticated using (is_system and organization_id is null);

create or replace function public.email_campaign_audit_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Email campaign audit events are append-only'; end $$;
create trigger email_campaign_audit_no_update before update on public.email_campaign_audit_events for each row execute function public.email_campaign_audit_immutable();
create trigger email_campaign_audit_no_delete before delete on public.email_campaign_audit_events for each row execute function public.email_campaign_audit_immutable();

comment on table public.marketing_contact_preferences is 'Marketing consent, suppression, and verification linked to the canonical CRM supporter.';
comment on table public.email_campaigns is 'Organization-scoped marketing campaigns; transactional email remains separate.';
comment on column public.email_campaigns.open_count is 'Estimated opens; privacy systems can make open tracking unreliable.';
comment on column public.email_campaigns.attributed_amount_cents is 'Only reliable campaign-associated conversion activity may be counted.';
