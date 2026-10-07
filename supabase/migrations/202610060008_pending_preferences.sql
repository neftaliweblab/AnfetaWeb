create or replace function public.update_anfeta_preferences(p_user_id uuid,p_patch jsonb,p_expected_revision bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.user_preferences; entry jsonb; key text;
begin
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 if jsonb_typeof(p_patch) is distinct from 'object' or octet_length(p_patch::text)>100000 then raise exception 'invalid_patch'; end if;
 for key in select jsonb_object_keys(p_patch) loop
  if not (key=any(array['favorites','savedSearches','calendarLayouts','pushSubscriptions','receipts','voiceCommands','notifications','workSessions','pendingTasks'])) then raise exception 'invalid_preference'; end if;
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
 if p_patch ? 'pendingTasks' then
  if jsonb_typeof(p_patch->'pendingTasks') is distinct from 'array' or jsonb_array_length(p_patch->'pendingTasks')>500 then raise exception 'invalid_pending_tasks'; end if;
  for entry in select jsonb_array_elements(p_patch->'pendingTasks') loop
   if jsonb_typeof(entry->'id') is distinct from 'string' or jsonb_typeof(entry->'title') is distinct from 'string' or length(entry->>'title')>500 or jsonb_typeof(entry->'query') is distinct from 'string' or length(entry->>'query')>4000 or jsonb_typeof(entry->'scheduledDate') is distinct from 'string' then raise exception 'invalid_pending_task'; end if;
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
