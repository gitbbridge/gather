-- Gather Donor CRM. The existing organization-scoped supporters table remains
-- the canonical constituent identity and existing Gather transactions remain
-- the financial source of truth.

alter table public.supporters
  add column if not exists secondary_email text,
  add column if not exists company_name text,
  add column if not exists status text not null default 'active'
    check (status in ('active','lapsed','inactive','deceased','do_not_contact')),
  add column if not exists roles text[] not null default '{}',
  add column if not exists contact_preferences jsonb not null default '{}'::jsonb;

alter table public.marketing_contact_preferences
  add column if not exists sms_marketing_status text not null default 'unknown'
    check (sms_marketing_status in ('unknown','subscribed','unsubscribed')),
  add column if not exists sms_consent_source text,
  add column if not exists sms_consent_recorded_at timestamptz;

create table public.crm_households (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 140),
  mailing_address jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,name)
);

create table public.crm_household_members (
  household_id uuid not null references public.crm_households(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supporter_id uuid not null references public.supporters(id) on delete cascade,
  relationship text not null default 'member' check (relationship in ('primary','spouse_partner','dependent','member')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (household_id,supporter_id),
  unique (organization_id,supporter_id)
);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supporter_id uuid references public.supporters(id) on delete cascade,
  household_id uuid references public.crm_households(id) on delete cascade,
  auction_id uuid references public.auctions(id) on delete set null,
  opportunity_id uuid,
  title text not null check (char_length(title) between 2 and 180),
  description text not null default '' check (char_length(description) <= 4000),
  due_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  source text not null default 'manual' check (source in ('manual','significant_donation','auction_win','unpaid_purchase','sponsorship_commitment','missed_event')),
  dedupe_key text,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,dedupe_key)
);

create table public.crm_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  significant_donation_threshold_cents integer not null default 100000 check (significant_donation_threshold_cents > 0),
  lapsed_after_months integer not null default 12 check (lapsed_after_months between 1 and 60),
  updated_at timestamptz not null default now()
);

create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supporter_id uuid references public.supporters(id) on delete set null,
  company_name text,
  opportunity_type text not null check (opportunity_type in ('major_gift','corporate_sponsorship','auction_item_donation')),
  name text not null check (char_length(name) between 2 and 180),
  stage text not null default 'prospect' check (stage in ('prospect','contacted','committed','fulfilled','thanked')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  assigned_to uuid references auth.users(id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 4000),
  next_task_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.crm_tasks add constraint crm_tasks_opportunity_fk foreign key (opportunity_id) references public.crm_opportunities(id) on delete cascade;

create table public.crm_pledges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supporter_id uuid references public.supporters(id) on delete set null,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  auction_id uuid references public.auctions(id) on delete set null,
  pledge_type text not null check (pledge_type in ('donation','sponsorship','auction_purchase')),
  amount_cents integer not null check (amount_cents > 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  status text not null default 'pledged' check (status in ('pledged','payment_pending','paid','declined','cancelled','refunded')),
  authoritative_source text not null default 'crm_pledge' check (authoritative_source in ('crm_pledge','sponsorship','winner_invoice','fund_a_need')),
  authoritative_source_id uuid,
  due_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_cents <= amount_cents)
);

create table public.crm_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supporter_id uuid references public.supporters(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (supporter_id is not null or opportunity_id is not null)
);

create table public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supporter_id uuid references public.supporters(id) on delete set null,
  actor_id uuid not null references auth.users(id),
  action text not null,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

create index crm_households_org_idx on public.crm_households(organization_id,name);
create index crm_tasks_org_due_idx on public.crm_tasks(organization_id,status,due_at);
create index crm_tasks_supporter_idx on public.crm_tasks(supporter_id,created_at desc);
create index crm_opportunities_org_stage_idx on public.crm_opportunities(organization_id,stage,updated_at desc);
create index crm_pledges_org_status_idx on public.crm_pledges(organization_id,status,due_at);
create index crm_attachments_supporter_idx on public.crm_attachments(supporter_id,created_at desc);
create index crm_audit_org_time_idx on public.crm_audit_events(organization_id,created_at desc);
create index supporters_roles_idx on public.supporters using gin(roles);

create trigger crm_households_updated_at before update on public.crm_households for each row execute procedure public.set_updated_at();
create trigger crm_tasks_updated_at before update on public.crm_tasks for each row execute procedure public.set_updated_at();
create trigger crm_settings_updated_at before update on public.crm_settings for each row execute procedure public.set_updated_at();
create trigger crm_opportunities_updated_at before update on public.crm_opportunities for each row execute procedure public.set_updated_at();
create trigger crm_pledges_updated_at before update on public.crm_pledges for each row execute procedure public.set_updated_at();

alter table public.crm_households enable row level security;
alter table public.crm_household_members enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_settings enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_pledges enable row level security;
alter table public.crm_attachments enable row level security;
alter table public.crm_audit_events enable row level security;

do $$ declare table_name text;
begin
  foreach table_name in array array['crm_households','crm_household_members','crm_tasks','crm_settings','crm_opportunities','crm_pledges','crm_attachments','crm_audit_events']
  loop
    execute format('create policy "Organization members read %1$s" on public.%1$I for select to authenticated using (private.is_organization_member(organization_id))', table_name);
    execute format('create policy "Organization editors manage %1$s" on public.%1$I for all to authenticated using (private.is_organization_member(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[])) with check (private.is_organization_member(organization_id, array[''owner'',''admin'',''editor'']::public.organization_role[]))', table_name);
  end loop;
end $$;

create or replace function public.crm_audit_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'CRM audit events are append-only'; end $$;
create trigger crm_audit_no_update before update on public.crm_audit_events for each row execute function public.crm_audit_immutable();
create trigger crm_audit_no_delete before delete on public.crm_audit_events for each row execute function public.crm_audit_immutable();

do $$ begin
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('crm-attachments','crm-attachments',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain'])
  on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
exception when undefined_table then null; end $$;

comment on table public.crm_pledges is 'CRM commitments and exception tracking only. Existing Gather payment records remain authoritative.';
comment on table public.crm_opportunities is 'Nonprofit fundraising pipeline limited to major gifts, sponsorships, and auction-item donations.';
comment on table public.crm_attachments is 'Private CRM attachment metadata; file bytes live in the private crm-attachments storage bucket.';
