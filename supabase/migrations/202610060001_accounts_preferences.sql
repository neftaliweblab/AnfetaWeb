begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 person_tag text not null unique check (person_tag in ('jjohn','nneft','kkarl','iisai','ssote','aacal','aandr','bbria','ggena','eemma')),
 login_email text not null unique check (position('@' in login_email)>1),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.user_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 revision bigint not null default 0 check (revision>=0),
 values jsonb not null default '{}'::jsonb check (jsonb_typeof(values)='object' and octet_length(values::text)<=100000),
 updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
revoke all on public.profiles,public.user_preferences from anon,authenticated;
grant select on public.profiles,public.user_preferences to authenticated;
grant all on public.profiles,public.user_preferences to service_role;
create policy own_profile on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy own_preferences on public.user_preferences for select to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=user_id and p.active));
-- Writes use a server-only RPC. The browser cannot assign roles or overwrite someone else's preferences.
create function public.update_anfeta_preferences(p_user_id uuid,p_patch jsonb,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.user_preferences; entry jsonb; key text;
begin
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 if jsonb_typeof(p_patch) is distinct from 'object' or octet_length(p_patch::text)>100000 then raise exception 'invalid_patch'; end if;
 for key in select jsonb_object_keys(p_patch) loop
  if not (key=any(array['favorites','savedSearches','calendarLayouts','pushSubscriptions','receipts','voiceCommands','notifications','workSessions'])) then raise exception 'invalid_preference'; end if;
 end loop;
 if p_patch ? 'favorites' then
  if jsonb_typeof(p_patch->'favorites')<>'array' then raise exception 'invalid_favorites'; end if;
  if jsonb_array_length(p_patch->'favorites')>2000 then raise exception 'too_many_favorites'; end if;
  for entry in select jsonb_array_elements(p_patch->'favorites') loop
   if jsonb_typeof(entry)<>'string' or length(entry#>>'{}')>1000 then raise exception 'invalid_favorite'; end if;
  end loop;
 end if;
 if p_patch ? 'savedSearches' then
  if jsonb_typeof(p_patch->'savedSearches')<>'array' then raise exception 'invalid_searches'; end if;
  if jsonb_array_length(p_patch->'savedSearches')>100 then raise exception 'too_many_searches'; end if;
  for entry in select jsonb_array_elements(p_patch->'savedSearches') loop
   if jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'id') is distinct from 'string' or jsonb_typeof(entry->'query') is distinct from 'string' or length(trim(entry->>'query'))=0 or length(entry->>'query')>4000 then raise exception 'invalid_search'; end if;
  end loop;
 end if;
 -- Serializes concurrent writes, including the first insert, across all web instances.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 insert into public.user_preferences(user_id) values(p_user_id) on conflict do nothing;
 select * into current_row from public.user_preferences where user_id=p_user_id for update;
 if p_expected_revision is not null and p_expected_revision<>current_row.revision then raise exception 'revision_conflict'; end if;
 update public.user_preferences set values=values||p_patch,revision=revision+1,updated_at=now() where user_id=p_user_id returning * into current_row;
 return jsonb_build_object('revision',current_row.revision,'values',current_row.values,'updated_at',current_row.updated_at);
end;
$$;
revoke all on function public.update_anfeta_preferences(uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.update_anfeta_preferences(uuid,jsonb,bigint) to service_role;
-- Read-only views expose favorites/searches without creating conflicting copies of the JSON state.
create view public.favorites with (security_invoker=true) as select user_id,jsonb_array_elements_text(coalesce(values->'favorites','[]'::jsonb)) as resource_id from public.user_preferences;
create view public.saved_searches with (security_invoker=true) as select user_id,entry->>'id' as id,entry->>'query' as query,entry->>'updatedAt' as updated_at from public.user_preferences cross join lateral jsonb_array_elements(coalesce(values->'savedSearches','[]'::jsonb)) entry;
revoke all on public.favorites,public.saved_searches from anon,authenticated;
grant select on public.favorites,public.saved_searches to authenticated;
commit;
