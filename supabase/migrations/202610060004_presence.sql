begin;
create table public.team_presence(user_id uuid primary key references public.profiles(id) on delete cascade,last_seen timestamptz not null default now());
alter table public.team_presence enable row level security;
create policy team_presence_active on public.team_presence for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and active));
grant select on public.team_presence to authenticated;grant all on public.team_presence to service_role;
commit;
