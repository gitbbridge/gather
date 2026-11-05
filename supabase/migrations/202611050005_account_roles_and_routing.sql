-- Explicit account roles for post-authentication routing. Authorization still
-- comes from organization membership and bidder registration, never this label.
alter table public.profiles add column if not exists account_type text not null default 'supporter'
  check (account_type in ('organizer','supporter'));

update public.profiles p set account_type='organizer'
where exists(select 1 from public.organization_members m where m.user_id=p.id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,full_name,account_type)
  values(new.id,nullif(new.raw_user_meta_data->>'full_name',''),case when new.raw_user_meta_data->>'account_type'='organizer' then 'organizer' else 'supporter' end)
  on conflict(id) do update set full_name=coalesce(excluded.full_name,public.profiles.full_name);
  return new;
end;
$$;

comment on column public.profiles.account_type is 'Routing preference only. Permissions remain membership/registration based.';
