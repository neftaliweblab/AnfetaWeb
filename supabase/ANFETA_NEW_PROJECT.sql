-- ANFETA: Instalacion completa para proyecto nuevo de Supabase.
-- Ejecutar en el SQL Editor de Supabase (Ctrl+Enter o boton Run).
-- Orden verificado de migraciones 0001 a 0021 sin errores de dependencia.


-- ==========================================
-- 202610060001_accounts_preferences.sql
-- ==========================================
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

-- ==========================================
-- 202610060002_notion_cache.sql
-- ==========================================
begin;
create table public.notion_snapshots (
 user_id uuid not null references public.profiles(id) on delete cascade,
 source_key text not null,
 request_key text not null,
 payload jsonb,
 has_payload boolean not null default false,
 content_version text,
 updated_at timestamptz,
 valid boolean not null default false,
 force_full boolean not null default false,
 generation bigint not null default 0,
 lease_token uuid,
 lease_until timestamptz,
 last_error text,
 retry_after timestamptz,
 primary key(user_id,source_key,request_key)
);
create table public.sync_runs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 source_key text not null,request_key text not null,status text not null check(status in ('running','completed','failed','discarded')),
 started_at timestamptz not null default now(),finished_at timestamptz,error text,item_count integer
);
create table public.notion_pages (
 user_id uuid not null references public.profiles(id) on delete cascade,source_key text not null,page_id text not null,
 data jsonb not null,updated_at timestamptz not null default now(),primary key(user_id,source_key,page_id)
);
create table public.activity_cache (
 user_id uuid not null references public.profiles(id) on delete cascade,source_key text not null,request_key text not null,page_id text not null,
 data jsonb not null,updated_at timestamptz not null default now(),primary key(user_id,source_key,request_key,page_id)
);
create index sync_runs_recent on public.sync_runs(user_id,started_at desc);
create index notion_snapshot_source on public.notion_snapshots(source_key);
alter table public.notion_snapshots enable row level security;
alter table public.sync_runs enable row level security;
alter table public.notion_pages enable row level security;
alter table public.activity_cache enable row level security;
revoke all on public.notion_snapshots,public.sync_runs,public.notion_pages,public.activity_cache from anon,authenticated;
grant select on public.notion_snapshots,public.sync_runs,public.notion_pages,public.activity_cache to authenticated;
grant all on public.notion_snapshots,public.sync_runs,public.notion_pages,public.activity_cache to service_role;
create policy own_snapshot on public.notion_snapshots for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=user_id and p.active));
create policy own_sync_runs on public.sync_runs for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=user_id and p.active));
create policy own_notion_pages on public.notion_pages for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=user_id and p.active));
create policy own_activity_cache on public.activity_cache for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=user_id and p.active));
create function public.claim_notion_sync(p_user_id uuid,p_source_key text,p_request_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.notion_snapshots; token uuid; run uuid;
begin
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 insert into public.notion_snapshots(user_id,source_key,request_key) values(p_user_id,p_source_key,p_request_key) on conflict do nothing;
 select * into row from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key for update;
 if row.lease_until>now() then return null; end if;
 update public.sync_runs set status='failed',finished_at=now(),error='La ejecución anterior agotó su plazo.' where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key and status='running';
 token:=gen_random_uuid();run:=gen_random_uuid();
 update public.notion_snapshots set lease_token=token,lease_until=now()+interval '180 seconds' where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key;
 insert into public.sync_runs(id,user_id,source_key,request_key,status) values(run,p_user_id,p_source_key,p_request_key,'running');
 return jsonb_build_object('token',token,'generation',row.generation,'run_id',run);
end;$$;
create function public.finish_notion_sync(p_user_id uuid,p_source_key text,p_request_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_payload jsonb,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare row public.notion_snapshots; entry jsonb; pid text; ids text[]:=array[]::text[];
begin
 select * into row from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key for update;
 if not found or row.lease_token is distinct from p_token or row.generation<>p_generation then
  update public.sync_runs set status='discarded',finished_at=now() where id=p_run_id and user_id=p_user_id and status='running';return false;
 end if;
 if p_error is not null then
  update public.notion_snapshots set lease_token=null,lease_until=null,last_error=left(p_error,1000),retry_after=now()+interval '60 seconds' where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key;
  update public.sync_runs set status='failed',finished_at=now(),error=left(p_error,1000) where id=p_run_id and user_id=p_user_id;return false;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_snapshot'; end if;
 if p_request_key='search-index' then
  for entry in select jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
   if entry->>'source'='Notion' then
    pid:=coalesce(entry->>'externalId',entry->>'id');ids:=array_append(ids,pid);
    insert into public.notion_pages(user_id,source_key,page_id,data) values(p_user_id,p_source_key,pid,entry)
    on conflict(user_id,source_key,page_id) do update set data=excluded.data,updated_at=now() where public.notion_pages.data is distinct from excluded.data;
   end if;
  end loop;
  delete from public.notion_pages where user_id=p_user_id and source_key=p_source_key and not(page_id=any(ids));
 else
  for entry in select jsonb_array_elements(coalesce(p_payload->'activities','[]'::jsonb)) loop
   pid:=entry->>'pageId';ids:=array_append(ids,pid);
   insert into public.activity_cache(user_id,source_key,request_key,page_id,data) values(p_user_id,p_source_key,p_request_key,pid,entry)
   on conflict(user_id,source_key,request_key,page_id) do update set data=excluded.data,updated_at=now() where public.activity_cache.data is distinct from excluded.data;
  end loop;
  delete from public.activity_cache where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key and not(page_id=any(ids));
 end if;
 update public.notion_snapshots set payload=p_payload,has_payload=true,content_version=md5(coalesce(p_payload->'items',p_payload->'activities')::text),valid=true,force_full=false,updated_at=now(),last_error=null,retry_after=null,lease_token=null,lease_until=null where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key;
 update public.sync_runs set status='completed',finished_at=now(),item_count=jsonb_array_length(coalesce(p_payload->'items',p_payload->'activities','[]'::jsonb)) where id=p_run_id and user_id=p_user_id;
 return true;
end;$$;
create function public.invalidate_notion_cache(p_source_key text,p_force_full boolean default false)
returns void language sql security definer set search_path='' as $$
 update public.notion_snapshots set valid=false,force_full=force_full or p_force_full,generation=generation+1,lease_token=null,lease_until=null where source_key=p_source_key;
$$;
revoke all on function public.claim_notion_sync(uuid,text,text),public.finish_notion_sync(uuid,text,text,uuid,bigint,uuid,jsonb,text),public.invalidate_notion_cache(text,boolean) from public,anon,authenticated;
grant execute on function public.claim_notion_sync(uuid,text,text),public.finish_notion_sync(uuid,text,text,uuid,bigint,uuid,jsonb,text),public.invalidate_notion_cache(text,boolean) to service_role;
create function public.read_notion_index_slice(p_user_id uuid,p_source_key text,p_offset integer,p_limit integer,p_version text default null,p_known_version text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.notion_snapshots; entry jsonb; entries jsonb:='[]'::jsonb; version text; bytes integer:=0; total integer; n integer:=0;
begin
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'invalid_pagination'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 select * into row from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 if row.payload is null then return null; end if;
 version:=row.content_version;
 if p_version is not null and p_version<>version then return jsonb_build_object('error','La versión del índice cambió.','code','index_version_changed'); end if;
 if p_known_version=version then return jsonb_build_object('unchanged',true,'indexVersion',version,'nextOffset',null); end if;
 total:=jsonb_array_length(row.payload->'items');
 for entry in select value from jsonb_array_elements(row.payload->'items') with ordinality as t(value,ordinal) where ordinal>p_offset and ordinal<=p_offset+p_limit order by ordinal loop
  if bytes+octet_length(entry::text)>2000000 then
   if n=0 then raise exception 'index_row_too_large'; end if;exit;
  end if;
  entries:=entries||jsonb_build_array(entry);bytes:=bytes+octet_length(entry::text);n:=n+1;
 end loop;
 return (row.payload-'items')||jsonb_build_object('items',entries,'total',total,'indexVersion',version,'nextOffset',case when p_offset+n<total then p_offset+n else null end);
end;$$;
revoke all on function public.read_notion_index_slice(uuid,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.read_notion_index_slice(uuid,text,integer,integer,text,text) to service_role;
commit;

-- ==========================================
-- 202610060003_reminders.sql
-- ==========================================
begin;
create table public.reminders (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id), assignee_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title)) between 1 and 500), due_date date not null, due_time time not null,
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')), completed boolean not null default false,
 revision integer not null default 1, updated_at timestamptz not null default now()
);
create index reminders_assignee_date on public.reminders(assignee_id,due_date);
alter table public.reminders enable row level security;
create policy reminders_own_read on public.reminders for select to authenticated using((creator_id=auth.uid() or assignee_id=auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and active));
grant select on public.reminders to authenticated;grant all on public.reminders to service_role;
create function public.change_reminder(p_actor uuid,p_action text,p_id uuid,p_revision integer,p_title text,p_date date,p_time time,p_priority text,p_assignee uuid,p_completed boolean)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_action='create' then
  if not exists(select 1 from public.profiles where id=p_assignee and active) then raise exception 'inactive_assignee';end if;
  insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority) values(p_actor,p_assignee,p_title,p_date,p_time,p_priority) returning * into item;
 else
  select * into item from public.reminders where id=p_id for update;
  if item.id is null or (item.creator_id<>p_actor and item.assignee_id<>p_actor) then raise exception 'reminder_not_available';end if;
  if item.revision<>p_revision then raise exception 'revision_conflict';end if;
  if p_action='complete' then update public.reminders set completed=p_completed,revision=revision+1,updated_at=now() where id=p_id returning * into item;
  elsif p_action='delete' and item.creator_id=p_actor then delete from public.reminders where id=p_id;
  else raise exception 'action_not_allowed';end if;
 end if;return item;
end;$$;
revoke all on function public.change_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.change_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,boolean) to service_role;
commit;

-- ==========================================
-- 202610060004_presence.sql
-- ==========================================
begin;
create table public.team_presence(user_id uuid primary key references public.profiles(id) on delete cascade,last_seen timestamptz not null default now());
alter table public.team_presence enable row level security;
create policy team_presence_active on public.team_presence for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and active));
grant select on public.team_presence to authenticated;grant all on public.team_presence to service_role;
commit;

-- ==========================================
-- 202610060005_messages.sql
-- ==========================================
begin;
create table public.conversations(id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.profiles(id),title text not null check(length(trim(title)) between 1 and 200),members uuid[] not null check(cardinality(members) between 1 and 20),last_message_id bigint not null default 0,last_text text not null default '',updated_at timestamptz not null default now());
create table public.conversation_messages(id bigint generated always as identity primary key,conversation_id uuid not null references public.conversations(id) on delete cascade,author_id uuid not null references public.profiles(id),body text not null check(length(trim(body)) between 1 and 4000),created_at timestamptz not null default now());
create index conversation_messages_history on public.conversation_messages(conversation_id,id desc);
create table public.conversation_states(conversation_id uuid not null references public.conversations(id) on delete cascade,user_id uuid not null references public.profiles(id),last_read_id bigint not null default 0,status text not null default 'open' check(status in ('open','attention','archived')),primary key(conversation_id,user_id));
alter table public.conversations enable row level security;alter table public.conversation_messages enable row level security;alter table public.conversation_states enable row level security;
create policy conversations_member on public.conversations for select to authenticated using(auth.uid()=any(members) and exists(select 1 from public.profiles where id=auth.uid() and active));
create policy messages_member on public.conversation_messages for select to authenticated using(exists(select 1 from public.conversations where id=conversation_id));
create policy states_own on public.conversation_states for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.conversations where id=conversation_id));
grant select on public.conversations,public.conversation_messages,public.conversation_states to authenticated;
grant all on public.conversations,public.conversation_messages,public.conversation_states to service_role;grant usage,select on sequence public.conversation_messages_id_seq to service_role;
create function public.change_conversation(p_actor uuid,p_action text,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare thread public.conversations; message public.conversation_messages; member_ids uuid[];target uuid;read_id bigint;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_action='create' then
  select array_agg(distinct member) into member_ids from (select p_actor as member union all select value::uuid from jsonb_array_elements_text(p_input->'members')) m;
  if exists(select 1 from unnest(member_ids) as member where not exists(select 1 from public.profiles where id=member and active)) then raise exception 'inactive_member';end if;
  insert into public.conversations(creator_id,title,members) values(p_actor,p_input->>'title',member_ids) returning * into thread;
 else
  target:=(p_input->>'thread')::uuid;select * into thread from public.conversations where id=target for update;
  if thread.id is null or not(p_actor=any(thread.members)) then raise exception 'conversation_not_available';end if;
 end if;
 if p_action in ('create','send') then
  insert into public.conversation_messages(conversation_id,author_id,body) values(thread.id,p_actor,p_input->>'text') returning * into message;
  update public.conversations set last_message_id=message.id,last_text=left(message.body,180),updated_at=now() where id=thread.id;
  insert into public.conversation_states(conversation_id,user_id,last_read_id) values(thread.id,p_actor,message.id) on conflict(conversation_id,user_id) do update set last_read_id=excluded.last_read_id;
 elsif p_action='read' then
  read_id:=least(thread.last_message_id,greatest(0,(p_input->>'lastRead')::bigint));
  insert into public.conversation_states(conversation_id,user_id,last_read_id) values(thread.id,p_actor,read_id) on conflict(conversation_id,user_id) do update set last_read_id=greatest(public.conversation_states.last_read_id,excluded.last_read_id);
 elsif p_action='status' then
  insert into public.conversation_states(conversation_id,user_id,status) values(thread.id,p_actor,p_input->>'status') on conflict(conversation_id,user_id) do update set status=excluded.status;
 else raise exception 'invalid_action';end if;
 return jsonb_build_object('thread',thread.id,'messageId',message.id);
end;$$;
revoke all on function public.change_conversation(uuid,text,jsonb) from public,anon,authenticated;grant execute on function public.change_conversation(uuid,text,jsonb) to service_role;
commit;

-- ==========================================
-- 202610060006_automation_jobs.sql
-- ==========================================
begin;
create table public.automation_jobs(source_key text not null,day date not null,actor_tag text not null,scope_all boolean not null default false,status text not null default 'pending' check(status in ('pending','running','completed','failed')),lease_token uuid,lease_until timestamptz,updated_at timestamptz not null default now(),report jsonb,error text,primary key(source_key,day,actor_tag));
create table public.automation_attempts(token uuid primary key,source_key text not null,day date not null,actor_tag text not null,started_at timestamptz not null default now(),finished_at timestamptz,report jsonb,error text);
alter table public.automation_jobs enable row level security;alter table public.automation_attempts enable row level security;
create policy jobs_own on public.automation_jobs for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and person_tag=actor_tag and active));
create policy attempts_own on public.automation_attempts for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and person_tag=actor_tag and active));
grant select on public.automation_jobs,public.automation_attempts to authenticated;grant all on public.automation_jobs,public.automation_attempts to service_role;
create function public.claim_automation_job(p_source text,p_day date,p_actor text,p_scope_all boolean,p_force boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(p_source||p_day::text,0));
 if not exists(select 1 from public.profiles where person_tag=p_actor and active) then raise exception 'inactive_profile';end if;
 if exists(select 1 from public.automation_jobs where source_key=p_source and day=p_day and lease_until>now()) then return jsonb_build_object('state','busy');end if;
 if not p_force and exists(select 1 from public.automation_jobs where source_key=p_source and day=p_day and status='completed' and (scope_all or actor_tag=p_actor)) then return jsonb_build_object('state','completed');end if;
 insert into public.automation_jobs(source_key,day,actor_tag,scope_all,status,lease_token,lease_until) values(p_source,p_day,p_actor,p_scope_all,'running',token,now()+interval '180 seconds') on conflict(source_key,day,actor_tag) do update set status='running',scope_all=excluded.scope_all,lease_token=token,lease_until=excluded.lease_until,error=null,updated_at=now();
 insert into public.automation_attempts(token,source_key,day,actor_tag) values(token,p_source,p_day,p_actor);
 return jsonb_build_object('state','claimed','token',token);
end;$$;
create function public.finish_automation_job(p_token uuid,p_report jsonb,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.automation_jobs set status=case when p_error is not null then 'failed' when coalesce((p_report->>'remaining')::integer,0)>0 or coalesce((p_report->>'failed')::integer,0)>0 then 'pending' else 'completed' end,report=p_report,error=p_error,lease_token=null,lease_until=null,updated_at=now() where lease_token=p_token and lease_until>now();
 if not found then return false;end if;
 update public.automation_attempts set finished_at=now(),report=p_report,error=p_error where token=p_token;return true;
end;$$;
revoke all on function public.claim_automation_job(text,date,text,boolean,boolean),public.finish_automation_job(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_automation_job(text,date,text,boolean,boolean),public.finish_automation_job(uuid,jsonb,text) to service_role;
commit;

-- ==========================================
-- 202610060007_checklist_history.sql
-- ==========================================
begin;
create table public.checklist_marks(source_key text not null,page_id text not null,block_id text not null,checked boolean not null,marked_at timestamptz,marking_source text not null default 'unknown' check(marking_source in ('unknown','web')),observed_at timestamptz not null default now(),primary key(source_key,page_id,block_id));
create table public.checklist_mark_events(id uuid primary key default gen_random_uuid(),source_key text not null,page_id text not null,block_id text not null,actor_tag text not null,checked boolean not null,changed_at timestamptz not null default now());
alter table public.checklist_marks enable row level security;alter table public.checklist_mark_events enable row level security;
create policy marks_source on public.checklist_marks for select to authenticated using(exists(select 1 from public.notion_snapshots where user_id=auth.uid() and source_key=public.checklist_marks.source_key) and exists(select 1 from public.profiles where id=auth.uid() and active));
create policy events_actor on public.checklist_mark_events for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and person_tag=actor_tag and active));
grant select on public.checklist_marks,public.checklist_mark_events to authenticated;grant all on public.checklist_marks,public.checklist_mark_events to service_role;
create function public.observe_checklist(p_source text,p_page text,p_items jsonb,p_observed_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare entry jsonb;
begin
 for entry in select value from jsonb_array_elements(p_items) loop
  insert into public.checklist_marks(source_key,page_id,block_id,checked,observed_at) values(p_source,p_page,entry->>'id',(entry->>'checked')::boolean,p_observed_at)
  on conflict(source_key,page_id,block_id) do update set checked=excluded.checked,marked_at=case when public.checklist_marks.checked=excluded.checked then public.checklist_marks.marked_at else null end,marking_source=case when public.checklist_marks.checked=excluded.checked then public.checklist_marks.marking_source else 'unknown' end,observed_at=excluded.observed_at where public.checklist_marks.observed_at<=excluded.observed_at;
 end loop;
 return coalesce((select jsonb_agg(to_jsonb(m)) from public.checklist_marks m where source_key=p_source and page_id=p_page),'[]'::jsonb);
end;$$;
create function public.record_checklist_mark(p_source text,p_page text,p_block text,p_actor text,p_previous boolean,p_checked boolean) returns void language plpgsql security definer set search_path='' as $$
declare row public.checklist_marks;
begin
 if not exists(select 1 from public.profiles where person_tag=p_actor and active) then raise exception 'inactive_profile';end if;
 insert into public.checklist_marks(source_key,page_id,block_id,checked) values(p_source,p_page,p_block,p_previous) on conflict do nothing;
 select * into row from public.checklist_marks where source_key=p_source and page_id=p_page and block_id=p_block for update;
 if p_previous<>p_checked and (row.checked<>p_checked or row.marking_source='unknown') then
  insert into public.checklist_mark_events(source_key,page_id,block_id,actor_tag,checked) values(p_source,p_page,p_block,p_actor,p_checked);
  update public.checklist_marks set checked=p_checked,marked_at=case when p_checked then now() else null end,marking_source='web',observed_at=now() where source_key=p_source and page_id=p_page and block_id=p_block;
 end if;
end;$$;
revoke all on function public.observe_checklist(text,text,jsonb,timestamptz),public.record_checklist_mark(text,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.observe_checklist(text,text,jsonb,timestamptz),public.record_checklist_mark(text,text,text,text,boolean,boolean) to service_role;
commit;

-- ==========================================
-- 202610060008_pending_preferences.sql
-- ==========================================
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

-- ==========================================
-- 202610060009_index_bulk_save.sql
-- ==========================================
begin;
create or replace function public.finish_notion_sync(p_user_id uuid,p_source_key text,p_request_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_payload jsonb,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare row public.notion_snapshots; entry jsonb; pid text; ids text[]:=array[]::text[];
begin
 select * into row from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key for update;
 if not found or row.lease_token is distinct from p_token or row.generation<>p_generation then
  update public.sync_runs set status='discarded',finished_at=now() where id=p_run_id and user_id=p_user_id and status='running';return false;
 end if;
 if p_error is not null then
  update public.notion_snapshots set lease_token=null,lease_until=null,last_error=left(p_error,1000),retry_after=now()+interval '60 seconds' where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key;
  update public.sync_runs set status='failed',finished_at=now(),error=left(p_error,1000) where id=p_run_id and user_id=p_user_id;return false;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_snapshot'; end if;
 if p_request_key='search-index' then
  with entries as (
   select distinct on (coalesce(value->>'externalId',value->>'id')) coalesce(value->>'externalId',value->>'id') as page_id,value as data
   from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) with ordinality as e(value,ordinal)
   where value->>'source'='Notion' and nullif(coalesce(value->>'externalId',value->>'id'),'') is not null
   order by coalesce(value->>'externalId',value->>'id'),ordinal desc
  )
  insert into public.notion_pages(user_id,source_key,page_id,data)
  select p_user_id,p_source_key,page_id,data from entries
  on conflict(user_id,source_key,page_id) do update set data=excluded.data,updated_at=now()
  where public.notion_pages.data is distinct from excluded.data;
  delete from public.notion_pages n where n.user_id=p_user_id and n.source_key=p_source_key
  and not exists(select 1 from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) e where e->>'source'='Notion' and coalesce(e->>'externalId',e->>'id')=n.page_id);
 else
  for entry in select jsonb_array_elements(coalesce(p_payload->'activities','[]'::jsonb)) loop
   pid:=entry->>'pageId';ids:=array_append(ids,pid);
   insert into public.activity_cache(user_id,source_key,request_key,page_id,data) values(p_user_id,p_source_key,p_request_key,pid,entry)
   on conflict(user_id,source_key,request_key,page_id) do update set data=excluded.data,updated_at=now() where public.activity_cache.data is distinct from excluded.data;
  end loop;
  delete from public.activity_cache where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key and not(page_id=any(ids));
 end if;
 update public.notion_snapshots set payload=p_payload,has_payload=true,content_version=md5(coalesce(p_payload->'items',p_payload->'activities')::text),valid=true,force_full=false,updated_at=now(),last_error=null,retry_after=null,lease_token=null,lease_until=null where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key;
 update public.sync_runs set status='completed',finished_at=now(),item_count=jsonb_array_length(coalesce(p_payload->'items',p_payload->'activities','[]'::jsonb)) where id=p_run_id and user_id=p_user_id;
 return true;
end;$$;
commit;

-- ==========================================
-- 202610060010_index_linear_reconciliation.sql
-- ==========================================
begin;
create or replace function public.finish_notion_sync(p_user_id uuid,p_source_key text,p_request_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_payload jsonb,p_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare row public.notion_snapshots; entry jsonb; pid text; ids text[]:=array[]::text[];
begin
 select * into row from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key for update;
 if not found or row.lease_token is distinct from p_token or row.generation<>p_generation then
  update public.sync_runs set status='discarded',finished_at=now() where id=p_run_id and user_id=p_user_id and status='running';return false;
 end if;
 if p_error is not null then
  update public.notion_snapshots set lease_token=null,lease_until=null,last_error=left(p_error,1000),retry_after=now()+interval '60 seconds' where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key;
  update public.sync_runs set status='failed',finished_at=now(),error=left(p_error,1000) where id=p_run_id and user_id=p_user_id;return false;
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_snapshot'; end if;
 if p_request_key='search-index' then
  with entries as materialized (
   select distinct on (coalesce(value->>'externalId',value->>'id')) coalesce(value->>'externalId',value->>'id') as page_id,value as data
   from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) with ordinality as e(value,ordinal)
   where value->>'source'='Notion' and nullif(coalesce(value->>'externalId',value->>'id'),'') is not null
   order by coalesce(value->>'externalId',value->>'id'),ordinal desc
  ), written as (
  insert into public.notion_pages(user_id,source_key,page_id,data)
  select p_user_id,p_source_key,page_id,data from entries
  on conflict(user_id,source_key,page_id) do update set data=excluded.data,updated_at=now()
  where public.notion_pages.data is distinct from excluded.data
  returning page_id
  )
  delete from public.notion_pages n where n.user_id=p_user_id and n.source_key=p_source_key
  and n.page_id not in(select e.page_id from entries e);
 else
  for entry in select jsonb_array_elements(coalesce(p_payload->'activities','[]'::jsonb)) loop
   pid:=entry->>'pageId';ids:=array_append(ids,pid);
   insert into public.activity_cache(user_id,source_key,request_key,page_id,data) values(p_user_id,p_source_key,p_request_key,pid,entry)
   on conflict(user_id,source_key,request_key,page_id) do update set data=excluded.data,updated_at=now() where public.activity_cache.data is distinct from excluded.data;
  end loop;
  delete from public.activity_cache where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key and not(page_id=any(ids));
 end if;
 update public.notion_snapshots set payload=p_payload,has_payload=true,content_version=md5(coalesce(p_payload->'items',p_payload->'activities')::text),valid=true,force_full=false,updated_at=now(),last_error=null,retry_after=null,lease_token=null,lease_until=null where user_id=p_user_id and source_key=p_source_key and request_key=p_request_key;
 update public.sync_runs set status='completed',finished_at=now(),item_count=jsonb_array_length(coalesce(p_payload->'items',p_payload->'activities','[]'::jsonb)) where id=p_run_id and user_id=p_user_id;
 return true;
end;$$;
commit;

-- ==========================================
-- 202610060011_index_chunks.sql
-- ==========================================
begin;
create table if not exists public.notion_index_chunks (
 user_id uuid not null references public.profiles(id) on delete cascade,
 source_key text not null, run_id uuid not null references public.sync_runs(id) on delete cascade,
 start_offset integer not null check(start_offset>=0), items jsonb not null check(jsonb_typeof(items)='array'),
 primary key(user_id,source_key,run_id,start_offset)
);
alter table public.notion_index_chunks enable row level security;
revoke all on public.notion_index_chunks from anon,authenticated;
grant all on public.notion_index_chunks to service_role;
create or replace function public.stage_notion_index(p_user_id uuid,p_source_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_offset integer,p_items jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots;
begin
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index' for update;
 if not found or s.lease_token is distinct from p_token or s.generation<>p_generation then return false; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100 or p_offset<0 then raise exception 'invalid_batch'; end if;
 insert into public.notion_index_chunks values(p_user_id,p_source_key,p_run_id,p_offset,p_items)
 on conflict(user_id,source_key,run_id,start_offset) do update set items=excluded.items;
 update public.notion_snapshots set lease_until=now()+interval '180 seconds' where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 return true;
end;$$;
create or replace function public.publish_notion_index(p_user_id uuid,p_source_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_metadata jsonb,p_total integer,p_version text)
returns boolean language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots; n integer; complete boolean;
begin
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index' for update;
 if not found or s.lease_token is distinct from p_token or s.generation<>p_generation then return false; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 select coalesce(sum(jsonb_array_length(items)),0),coalesce(bool_and(start_offset=expected),true) into n,complete
 from (select start_offset,items,coalesce(sum(jsonb_array_length(items)) over(order by start_offset rows between unbounded preceding and 1 preceding),0) expected from public.notion_index_chunks where user_id=p_user_id and source_key=p_source_key and run_id=p_run_id) q;
 if n<>p_total or not complete or p_total<0 then raise exception 'incomplete_index'; end if;
 update public.notion_snapshots set payload=(p_metadata-'items')||jsonb_build_object('indexRunId',p_run_id,'total',p_total),has_payload=true,content_version=p_version,valid=true,force_full=false,updated_at=now(),last_error=null,retry_after=null,lease_token=null,lease_until=null where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 update public.sync_runs set status='completed',finished_at=now(),item_count=p_total where id=p_run_id and user_id=p_user_id;
 return true;
end;$$;
create or replace function public.read_notion_index_slice(p_user_id uuid,p_source_key text,p_offset integer,p_limit integer,p_version text default null,p_known_version text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots; result jsonb:='[]'; e jsonb; n integer:=0; bytes integer:=0; total integer;
begin
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'invalid_pagination'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 if s.payload is null then return null; end if;
 if p_version is not null and p_version<>s.content_version then return jsonb_build_object('code','index_version_changed','error','La versión del índice cambió.'); end if;
 if p_known_version=s.content_version then return jsonb_build_object('unchanged',true,'indexVersion',s.content_version,'nextOffset',null); end if;
 total:=coalesce((s.payload->>'total')::integer,jsonb_array_length(s.payload->'items'));
 for e in
 select value from (
  select t.value,c.start_offset+t.ordinal-1 as position from public.notion_index_chunks c cross join lateral jsonb_array_elements(c.items) with ordinality t(value,ordinal)
  where c.user_id=p_user_id and c.source_key=p_source_key and c.run_id=(s.payload->>'indexRunId')::uuid and c.start_offset<p_offset+p_limit and c.start_offset+jsonb_array_length(c.items)>p_offset
  union all
  select value,ordinal-1 from jsonb_array_elements(s.payload->'items') with ordinality t(value,ordinal) where not(s.payload ? 'indexRunId')
 ) q where position>=p_offset and position<p_offset+p_limit order by position
 loop
  if bytes+octet_length(e::text)>2000000 then if n=0 then raise exception 'index_row_too_large'; end if;exit;end if;
  result:=result||jsonb_build_array(e);bytes:=bytes+octet_length(e::text);n:=n+1;
 end loop;
 return (s.payload-'items')||jsonb_build_object('items',result,'total',total,'indexVersion',s.content_version,'nextOffset',case when p_offset+n<total then p_offset+n else null end);
end;$$;
revoke all on function public.stage_notion_index(uuid,text,uuid,bigint,uuid,integer,jsonb),public.publish_notion_index(uuid,text,uuid,bigint,uuid,jsonb,integer,text),public.read_notion_index_slice(uuid,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.stage_notion_index(uuid,text,uuid,bigint,uuid,integer,jsonb),public.publish_notion_index(uuid,text,uuid,bigint,uuid,jsonb,integer,text),public.read_notion_index_slice(uuid,text,integer,integer,text,text) to service_role;
commit;

-- ==========================================
-- 202610070012_reminders_snooze.sql
-- ==========================================
begin;
create or replace function public.snooze_reminder(p_actor uuid,p_id uuid,p_revision integer,p_minutes integer)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders; destination timestamp;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_minutes not in(15,60,1440) then raise exception 'invalid_delay';end if;
 select * into item from public.reminders where id=p_id for update;
 if item.id is null or (item.creator_id<>p_actor and item.assignee_id<>p_actor) then raise exception 'reminder_not_available';end if;
 if item.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
 if item.completed then raise exception 'completed_reminder';end if;
 destination:=greatest(item.due_date+item.due_time,now() at time zone 'America/Mexico_City')+make_interval(mins=>p_minutes);
 update public.reminders set due_date=destination::date,due_time=date_trunc('minute',destination)::time,revision=revision+1,updated_at=now() where id=p_id returning * into item;
 return item;
end;$$;
revoke all on function public.snooze_reminder(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.snooze_reminder(uuid,uuid,integer,integer) to service_role;
commit;

-- ==========================================
-- 202610070013_reminders_recurrence.sql
-- ==========================================
begin;
alter table public.reminders add column if not exists recurrence text not null default 'none' check(recurrence in('none','daily','weekly','monthly'));
alter table public.reminders add column if not exists recurrence_day integer check(recurrence_day between 1 and 31);
alter table public.reminders add column if not exists previous_id uuid references public.reminders(id) on delete set null;
create unique index if not exists reminders_previous_unique on public.reminders(previous_id) where previous_id is not null;

create or replace function public.change_reminder(p_actor uuid,p_action text,p_id uuid,p_revision integer,p_title text,p_date date,p_time time,p_priority text,p_assignee uuid,p_completed boolean)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders; was_completed boolean; next_date date; month_start date; wanted_day integer;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_action='create' then
  if not exists(select 1 from public.profiles where id=p_assignee and active) then raise exception 'inactive_assignee';end if;
  insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority) values(p_actor,p_assignee,p_title,p_date,p_time,p_priority) returning * into item;
 else
  select * into item from public.reminders where id=p_id for update;
  if item.id is null or (item.creator_id<>p_actor and item.assignee_id<>p_actor) then raise exception 'reminder_not_available';end if;
  if item.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
  if p_action='complete' then
   if p_completed is null then raise exception 'invalid_completed';end if;
   was_completed:=item.completed;
   update public.reminders set completed=p_completed,revision=revision+1,updated_at=now() where id=p_id returning * into item;
   if p_completed and not was_completed and item.recurrence<>'none' then
    if item.recurrence='daily' then next_date:=item.due_date+1;
    elsif item.recurrence='weekly' then next_date:=item.due_date+7;
    else
     wanted_day:=coalesce(item.recurrence_day,extract(day from item.due_date)::integer);
     month_start:=(date_trunc('month',item.due_date)+interval '1 month')::date;
     next_date:=month_start+least(wanted_day,extract(day from month_start+interval '1 month - 1 day')::integer)-1;
    end if;
    insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority,recurrence,recurrence_day,previous_id)
     values(item.creator_id,item.assignee_id,item.title,next_date,item.due_time,item.priority,item.recurrence,coalesce(item.recurrence_day,extract(day from item.due_date)::integer),item.id)
     on conflict(previous_id) where previous_id is not null do nothing;
   end if;
  elsif p_action='delete' and item.creator_id=p_actor then delete from public.reminders where id=p_id;
  else raise exception 'action_not_allowed';end if;
 end if;
 return item;
end;$$;

create or replace function public.edit_reminder(p_actor uuid,p_action text,p_id uuid,p_revision integer,p_title text,p_date date,p_time time,p_priority text,p_assignee uuid,p_recurrence text)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_recurrence is null or p_recurrence not in('none','daily','weekly','monthly') or p_title is null or length(trim(p_title)) not between 1 and 500 or p_date is null or p_time is null or p_priority is null or p_priority not in('low','medium','high','urgent') then raise exception 'invalid_reminder';end if;
 if not exists(select 1 from public.profiles where id=p_assignee and active) then raise exception 'inactive_assignee';end if;
 if p_action='create' then
  insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority,recurrence,recurrence_day) values(p_actor,p_assignee,trim(p_title),p_date,p_time,p_priority,p_recurrence,extract(day from p_date)::integer) returning * into item;
 elsif p_action='edit' then
  select * into item from public.reminders where id=p_id for update;
  if item.id is null or item.creator_id<>p_actor then raise exception 'reminder_not_available';end if;
  if item.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
  if item.completed then raise exception 'completed_reminder';end if;
  update public.reminders set title=trim(p_title),due_date=p_date,due_time=p_time,priority=p_priority,assignee_id=p_assignee,recurrence=p_recurrence,recurrence_day=case when due_date=p_date then coalesce(recurrence_day,extract(day from p_date)::integer) else extract(day from p_date)::integer end,revision=revision+1,updated_at=now() where id=p_id returning * into item;
 else raise exception 'action_not_allowed';end if;
 return item;
end;$$;
revoke all on function public.edit_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,text) from public,anon,authenticated;
grant execute on function public.edit_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,text) to service_role;
commit;

-- ==========================================
-- 202610130014_reliable_operations.sql
-- ==========================================
begin;
create table if not exists public.activity_leases(key text primary key,token uuid not null,expires_at timestamptz not null);
create table if not exists public.delivery_receipts(key text primary key,token uuid not null,state text not null check(state in ('running','done','uncertain')),result jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.activity_leases enable row level security;
alter table public.delivery_receipts enable row level security;
revoke all on public.activity_leases,public.delivery_receipts from anon,authenticated;
create or replace function public.claim_activity_lease(p_key text,p_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_leases(key,token,expires_at) values(p_key,p_token,now()+interval '5 minutes') on conflict(key) do update set token=excluded.token,expires_at=excluded.expires_at where public.activity_leases.expires_at<now();
 return found;
end;$$;
create or replace function public.release_activity_lease(p_key text,p_token uuid) returns void language sql security definer set search_path='' as $$ delete from public.activity_leases where key=p_key and token=p_token; $$;
create or replace function public.claim_delivery(p_key text,p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.delivery_receipts;
begin
 insert into public.delivery_receipts(key,token,state) values(p_key,p_token,'running') on conflict do nothing;
 if found then return jsonb_build_object('state','claimed'); end if;
 select * into item from public.delivery_receipts where key=p_key;
 return jsonb_build_object('state',item.state,'result',item.result);
end;$$;
create or replace function public.finish_delivery(p_key text,p_token uuid,p_result jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.delivery_receipts set state='done',result=p_result,updated_at=now() where key=p_key and token=p_token and state='running';
 if not found then raise exception 'operation_not_owned';end if;
end;$$;
create or replace function public.uncertain_delivery(p_key text,p_token uuid) returns void language sql security definer set search_path='' as $$ update public.delivery_receipts set state='uncertain',updated_at=now() where key=p_key and token=p_token and state='running'; $$;
revoke all on function public.claim_activity_lease(text,uuid),public.release_activity_lease(text,uuid),public.claim_delivery(text,uuid),public.finish_delivery(text,uuid,jsonb),public.uncertain_delivery(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_activity_lease(text,uuid),public.release_activity_lease(text,uuid),public.claim_delivery(text,uuid),public.finish_delivery(text,uuid,jsonb),public.uncertain_delivery(text,uuid) to service_role;
commit;

-- ==========================================
-- 202610130015_index_load_control.sql
-- ==========================================
begin;
-- Check an existing immutable generation before staging the same catalog again.
create or replace function public.finish_unchanged_notion_index(p_user_id uuid,p_source_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_version text,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots;
begin
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index' for update;
 if not found or s.lease_token is distinct from p_token or s.generation<>p_generation then return jsonb_build_object('state','discarded');end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile';end if;
 if not s.has_payload or s.content_version is distinct from p_version or not(s.payload ? 'indexRunId') then return jsonb_build_object('state','changed');end if;
 update public.notion_snapshots set payload=(s.payload || (p_metadata-'items'-'indexRunId'-'total')),valid=true,force_full=false,updated_at=now(),last_error=null,retry_after=null,lease_token=null,lease_until=null where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 update public.sync_runs set status='completed',finished_at=now(),item_count=(s.payload->>'total')::integer where id=p_run_id and user_id=p_user_id and status='running';
 return jsonb_build_object('state','unchanged');
end;$$;
-- Only obsolete cache chunks, never snapshots, user data or an active/staging generation.
create or replace function public.cleanup_obsolete_notion_chunks(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if p_limit<1 or p_limit>200 then raise exception 'invalid_cleanup_limit';end if;
 with obsolete as materialized (
  select c.user_id,c.source_key,c.run_id,c.start_offset from public.notion_index_chunks c
  join public.sync_runs r on r.id=c.run_id
  where r.status in ('completed','failed','discarded') and r.finished_at<now()-interval '1 hour'
   and not exists(select 1 from public.notion_snapshots s where s.user_id=c.user_id and s.source_key=c.source_key and s.payload->>'indexRunId'=c.run_id::text)
  limit p_limit for update of c skip locked
 )
 delete from public.notion_index_chunks c using obsolete o where c.user_id=o.user_id and c.source_key=o.source_key and c.run_id=o.run_id and c.start_offset=o.start_offset;
 get diagnostics removed=row_count;return removed;
end;$$;
create or replace function public.read_notion_index_slice(p_user_id uuid,p_source_key text,p_offset integer,p_limit integer,p_version text default null,p_known_version text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots; result jsonb; n integer; total integer;
begin
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'invalid_pagination';end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile';end if;
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 if s.payload is null then return null;end if;
 if p_version is not null and p_version<>s.content_version then return jsonb_build_object('code','index_version_changed','error','La versión del índice cambió.');end if;
 if p_known_version=s.content_version then return jsonb_build_object('unchanged',true,'indexVersion',s.content_version,'total',coalesce((s.payload->>'total')::integer,jsonb_array_length(s.payload->'items')),'nextOffset',null);end if;
 total:=coalesce((s.payload->>'total')::integer,jsonb_array_length(s.payload->'items'));
 with candidates as materialized (
  select value,position,octet_length(value::text) bytes from (
   select t.value,c.start_offset+t.ordinal-1 as position from public.notion_index_chunks c cross join lateral jsonb_array_elements(c.items) with ordinality t(value,ordinal)
   where c.user_id=p_user_id and c.source_key=p_source_key and c.run_id=(s.payload->>'indexRunId')::uuid and c.start_offset<p_offset+p_limit and c.start_offset+jsonb_array_length(c.items)>p_offset
   union all
   select value,ordinal-1 from jsonb_array_elements(s.payload->'items') with ordinality t(value,ordinal) where not(s.payload ? 'indexRunId')
  ) q where position>=p_offset and position<p_offset+p_limit
 ), sized as (select value,position,sum(bytes) over(order by position) cumulative_bytes from candidates)
 select coalesce(jsonb_agg(value order by position),'[]'::jsonb),count(*) into result,n from sized where cumulative_bytes<=2000000;
 if n=0 and p_offset<total then raise exception 'index_row_too_large';end if;
 return (s.payload-'items')||jsonb_build_object('items',result,'total',total,'indexVersion',s.content_version,'nextOffset',case when p_offset+n<total then p_offset+n else null end);
end;$$;
revoke all on function public.finish_unchanged_notion_index(uuid,text,uuid,bigint,uuid,text,jsonb),public.cleanup_obsolete_notion_chunks(integer),public.read_notion_index_slice(uuid,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.finish_unchanged_notion_index(uuid,text,uuid,bigint,uuid,text,jsonb),public.cleanup_obsolete_notion_chunks(integer),public.read_notion_index_slice(uuid,text,integer,integer,text,text) to service_role;
commit;

-- ==========================================
-- 202610130016_bounded_index_cleanup.sql
-- ==========================================
begin;
create or replace function public.cleanup_obsolete_notion_chunks(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if p_limit<1 or p_limit>2000 then raise exception 'invalid_cleanup_limit';end if;
 with obsolete as materialized (
  select c.user_id,c.source_key,c.run_id,c.start_offset from public.notion_index_chunks c
  join public.sync_runs r on r.id=c.run_id
  where r.status in ('completed','failed','discarded') and r.finished_at<now()-interval '1 hour'
   and not exists(select 1 from public.notion_snapshots s where s.user_id=c.user_id and s.source_key=c.source_key and s.payload->>'indexRunId'=c.run_id::text)
  limit p_limit for update of c skip locked
 )
 delete from public.notion_index_chunks c using obsolete o where c.user_id=o.user_id and c.source_key=o.source_key and c.run_id=o.run_id and c.start_offset=o.start_offset;
 get diagnostics removed=row_count;return removed;
end;$$;
revoke all on function public.cleanup_obsolete_notion_chunks(integer) from public,anon,authenticated;
grant execute on function public.cleanup_obsolete_notion_chunks(integer) to service_role;
commit;

-- ==========================================
-- 202610130017_shared_index_payloads.sql
-- ==========================================
begin;
-- New catalogs reuse identical immutable payloads; legacy chunks remain readable.
create table if not exists public.notion_index_payloads (
 source_key text not null, content_hash text not null, items jsonb not null check(jsonb_typeof(items)='array'),
 created_at timestamptz not null default now(), primary key(source_key,content_hash)
);
alter table public.notion_index_payloads enable row level security;
revoke all on public.notion_index_payloads from anon,authenticated;
grant all on public.notion_index_payloads to service_role;
alter table public.notion_index_chunks add column if not exists payload_hash text;
do $$begin if not exists(select 1 from pg_constraint where conname='notion_chunk_payload_fk' and conrelid='public.notion_index_chunks'::regclass) then alter table public.notion_index_chunks add constraint notion_chunk_payload_fk foreign key(source_key,payload_hash) references public.notion_index_payloads(source_key,content_hash);end if;end$$;
create or replace function public.stage_notion_index(p_user_id uuid,p_source_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_offset integer,p_items jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots; h text;
begin
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index' for update;
 if not found or s.lease_token is distinct from p_token or s.generation<>p_generation then return false; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100 or p_offset<0 then raise exception 'invalid_batch'; end if;
 h:=encode(sha256(convert_to(p_items::text,'UTF8')),'hex');
 insert into public.notion_index_payloads(source_key,content_hash,items) values(p_source_key,h,p_items) on conflict do nothing;
 insert into public.notion_index_chunks(user_id,source_key,run_id,start_offset,items,payload_hash) values(p_user_id,p_source_key,p_run_id,p_offset,'[]',h)
 on conflict(user_id,source_key,run_id,start_offset) do update set items='[]',payload_hash=excluded.payload_hash;
 update public.notion_snapshots set lease_until=now()+interval '180 seconds' where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 return true;
end;$$;
create or replace function public.publish_notion_index(p_user_id uuid,p_source_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_metadata jsonb,p_total integer,p_version text)
returns boolean language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots; n integer; complete boolean;
begin
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index' for update;
 if not found or s.lease_token is distinct from p_token or s.generation<>p_generation then return false; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile'; end if;
 select coalesce(sum(jsonb_array_length(items)),0),coalesce(bool_and(start_offset=expected),true) into n,complete
 from (select start_offset,items,coalesce(sum(jsonb_array_length(items)) over(order by start_offset rows between unbounded preceding and 1 preceding),0) expected from (select c.start_offset,coalesce(p.items,c.items) items from public.notion_index_chunks c left join public.notion_index_payloads p on p.source_key=c.source_key and p.content_hash=c.payload_hash where c.user_id=p_user_id and c.source_key=p_source_key and c.run_id=p_run_id) merged) q;
 if n<>p_total or not complete or p_total<0 then raise exception 'incomplete_index'; end if;
 update public.notion_snapshots set payload=(p_metadata-'items')||jsonb_build_object('indexRunId',p_run_id,'total',p_total),has_payload=true,content_version=p_version,valid=true,force_full=false,updated_at=now(),last_error=null,retry_after=null,lease_token=null,lease_until=null where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 update public.sync_runs set status='completed',finished_at=now(),item_count=p_total where id=p_run_id and user_id=p_user_id;
 return true;
end;$$;

create or replace function public.read_notion_index_slice(p_user_id uuid,p_source_key text,p_offset integer,p_limit integer,p_version text default null,p_known_version text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots; result jsonb; n integer; total integer;
begin
 if p_offset<0 or p_limit<1 or p_limit>500 then raise exception 'invalid_pagination';end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile';end if;
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 if s.payload is null then return null;end if;
 if p_version is not null and p_version<>s.content_version then return jsonb_build_object('code','index_version_changed','error','La versión del índice cambió.');end if;
 if p_known_version=s.content_version then return jsonb_build_object('unchanged',true,'indexVersion',s.content_version,'total',coalesce((s.payload->>'total')::integer,jsonb_array_length(s.payload->'items')),'nextOffset',null);end if;
 total:=coalesce((s.payload->>'total')::integer,jsonb_array_length(s.payload->'items'));
 with candidates as materialized (
  select value,position,octet_length(value::text) bytes from (
   select t.value,c.start_offset+t.ordinal-1 as position from public.notion_index_chunks c left join public.notion_index_payloads p on p.source_key=c.source_key and p.content_hash=c.payload_hash cross join lateral jsonb_array_elements(coalesce(p.items,c.items)) with ordinality t(value,ordinal)
   where c.user_id=p_user_id and c.source_key=p_source_key and c.run_id=(s.payload->>'indexRunId')::uuid and c.start_offset<p_offset+p_limit and c.start_offset+jsonb_array_length(coalesce(p.items,c.items))>p_offset
   union all
   select value,ordinal-1 from jsonb_array_elements(s.payload->'items') with ordinality t(value,ordinal) where not(s.payload ? 'indexRunId')
  ) q where position>=p_offset and position<p_offset+p_limit
 ), sized as (select value,position,sum(bytes) over(order by position) cumulative_bytes from candidates)
 select coalesce(jsonb_agg(value order by position),'[]'::jsonb),count(*) into result,n from sized where cumulative_bytes<=2000000;
 if n=0 and p_offset<total then raise exception 'index_row_too_large';end if;
 return (s.payload-'items')||jsonb_build_object('items',result,'total',total,'indexVersion',s.content_version,'nextOffset',case when p_offset+n<total then p_offset+n else null end);
end;$$;

create index if not exists notion_chunk_payload_reference on public.notion_index_chunks(source_key,payload_hash) where payload_hash is not null;
create or replace function public.cleanup_obsolete_notion_payloads(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if p_limit<1 or p_limit>200 then raise exception 'invalid_cleanup_limit';end if;
 with obsolete as materialized (
 select p.source_key,p.content_hash from public.notion_index_payloads p where p.created_at<now()-interval '1 hour'
 and not exists(select 1 from public.notion_index_chunks c where c.source_key=p.source_key and c.payload_hash=p.content_hash)
 limit p_limit for update of p skip locked
 ) delete from public.notion_index_payloads p using obsolete o where p.source_key=o.source_key and p.content_hash=o.content_hash;
 get diagnostics removed=row_count;return removed;
end;$$;
revoke all on function public.cleanup_obsolete_notion_payloads(integer) from public,anon,authenticated;
grant execute on function public.cleanup_obsolete_notion_payloads(integer) to service_role;
create or replace function public.finish_unchanged_notion_index(p_user_id uuid,p_source_key text,p_token uuid,p_generation bigint,p_run_id uuid,p_version text,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.notion_snapshots;
begin
 select * into s from public.notion_snapshots where user_id=p_user_id and source_key=p_source_key and request_key='search-index' for update;
 if not found or s.lease_token is distinct from p_token or s.generation<>p_generation then return jsonb_build_object('state','discarded');end if;
 if not exists(select 1 from public.profiles where id=p_user_id and active) then raise exception 'inactive_profile';end if;
 if not s.has_payload or s.content_version is distinct from p_version or not(s.payload ? 'indexRunId') or exists(select 1 from public.notion_index_chunks c where c.user_id=p_user_id and c.source_key=p_source_key and c.run_id=(s.payload->>'indexRunId')::uuid and c.payload_hash is null) then return jsonb_build_object('state','changed');end if;
 update public.notion_snapshots set payload=(s.payload || (p_metadata-'items'-'indexRunId'-'total')),valid=true,force_full=false,updated_at=now(),last_error=null,retry_after=null,lease_token=null,lease_until=null where user_id=p_user_id and source_key=p_source_key and request_key='search-index';
 update public.sync_runs set status='completed',finished_at=now(),item_count=(s.payload->>'total')::integer where id=p_run_id and user_id=p_user_id and status='running';
 return jsonb_build_object('state','unchanged');
end;$$;
commit;

-- ==========================================
-- 202610150018_activity_handoffs.sql
-- ==========================================
-- Historical visual copies reference the original Notion page; never duplicate it.
create table if not exists public.activity_handoffs (
 id uuid primary key,
 source_key text not null,
 page_id text not null,
 from_person text not null,
 to_person text not null,
 actor text not null,
 note text not null default '',
 snapshot jsonb not null,
 leave_copy boolean not null default true,
 confirmed boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists activity_handoffs_source_date on public.activity_handoffs(source_key, ((snapshot->>'start')));
alter table public.activity_handoffs enable row level security;
revoke all on public.activity_handoffs from anon, authenticated;
grant all on public.activity_handoffs to service_role;

-- ==========================================
-- 202610160019_whatsapp_directory.sql
-- ==========================================
-- Private server-only directory. WhatsApp session credentials never enter Supabase.
create table if not exists public.whatsapp_accounts (
 owner text primary key check (owner = 'John'),
 account_key text not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_groups (
 owner text not null references public.whatsapp_accounts(owner),
 group_id text not null check (group_id ~ '^[0-9]+(-[0-9]+)?@g\.us$'),
 name text not null check (length(name) between 1 and 1024),
 access_url text,
 last_seen_at timestamptz not null default now(),
 primary key(owner, group_id)
);
create table if not exists public.whatsapp_activity_links (
 owner text not null,
 group_id text not null,
 page_id text not null check (length(page_id) between 1 and 64),
 activity_title text not null check (length(activity_title) between 1 and 2048),
 created_at timestamptz not null default now(),
 primary key(owner, group_id, page_id),
 foreign key(owner, group_id) references public.whatsapp_groups(owner, group_id) on delete cascade
);
alter table public.whatsapp_accounts enable row level security;
alter table public.whatsapp_groups enable row level security;
alter table public.whatsapp_activity_links enable row level security;
revoke all on public.whatsapp_accounts, public.whatsapp_groups, public.whatsapp_activity_links from anon, authenticated;
grant all on public.whatsapp_accounts, public.whatsapp_groups, public.whatsapp_activity_links to service_role;

create or replace function public.import_anfeta_whatsapp_groups(p_account_key text, p_groups jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare existing_key text; imported integer;
begin
 perform pg_advisory_xact_lock(hashtext('anfeta-whatsapp-John'));
 if length(p_account_key) <> 64 or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) > 50 then
   raise exception 'invalid_import';
 end if;
 select account_key into existing_key from public.whatsapp_accounts where owner = 'John';
 if existing_key is not null and existing_key <> p_account_key then raise exception 'different_whatsapp_account'; end if;
 insert into public.whatsapp_accounts(owner,account_key) values('John',p_account_key)
 on conflict(owner) do update set updated_at = now();
 insert into public.whatsapp_groups(owner, group_id, name)
 select 'John', item->>'id', item->>'name' from jsonb_array_elements(p_groups) item
 on conflict(owner,group_id) do update set name = excluded.name, last_seen_at = now();
 get diagnostics imported = row_count;
 return imported;
end $$;
revoke all on function public.import_anfeta_whatsapp_groups(text,jsonb) from public, anon, authenticated;
grant execute on function public.import_anfeta_whatsapp_groups(text,jsonb) to service_role;

-- ==========================================
-- 202610190020_whatsapp_directory_multiuser.sql
-- ==========================================
-- Allow all ANFETA team members to have their own WhatsApp directory in Supabase
alter table if exists public.whatsapp_accounts drop constraint if exists whatsapp_accounts_owner_check;

-- Ensure foreign key cascade exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_groups_owner_fkey'
  ) then
    -- constraint is intact
    null;
  end if;
end $$;

-- ==========================================
-- 202610210021_notion_page_events.sql
-- ==========================================
begin;

create table if not exists public.notion_page_events (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  page_id text not null,
  state text not null check(state in ('deleted', 'active', 'unverified')),
  event_type text not null check(event_type in ('page.deleted', 'page.undeleted', 'page.properties_updated', 'page.content_updated', 'page.created', 'manual_delete', 'manual_restore', 'polled_state')),
  server_modified timestamptz not null default now(),
  event_timestamp timestamptz not null default now(),
  properties jsonb,
  unverified_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notion_page_events_source_page_key unique (source_key, page_id)
);

create index if not exists idx_notion_page_events_source_updated
  on public.notion_page_events (source_key, updated_at desc);

create index if not exists idx_notion_page_events_page_id
  on public.notion_page_events (page_id);

alter table public.notion_page_events enable row level security;

revoke all on public.notion_page_events from anon, authenticated;
grant select on public.notion_page_events to authenticated;
grant all on public.notion_page_events to service_role;

create policy select_notion_page_events on public.notion_page_events
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active));

create or replace function public.record_notion_page_event(
  p_source_key text,
  p_page_id text,
  p_state text,
  p_event_type text,
  p_server_modified timestamptz,
  p_properties jsonb default null,
  p_unverified_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_found boolean := false;
  v_state text;
  v_modified timestamptz;
  v_props jsonb;
  applied boolean := false;
  clean_id text := lower(replace(p_page_id, '-', ''));
begin
  select true, state, server_modified, properties
  into v_found, v_state, v_modified, v_props
  from public.notion_page_events
  where source_key = p_source_key and page_id = clean_id
  for update;

  if v_found then
    -- Monotonic protection: If incoming event is strictly older than existing, ignore it!
    if p_server_modified < v_modified then
      return jsonb_build_object(
        'applied', false,
        'reason', 'stale_event',
        'current_state', v_state,
        'current_modified', v_modified
      );
    end if;

    update public.notion_page_events
    set state = p_state,
        event_type = p_event_type,
        server_modified = p_server_modified,
        event_timestamp = now(),
        properties = coalesce(p_properties, case when p_state = 'deleted' then null else v_props end),
        unverified_reason = p_unverified_reason,
        updated_at = now()
    where source_key = p_source_key and page_id = clean_id;
    applied := true;
  else
    insert into public.notion_page_events (
      source_key, page_id, state, event_type, server_modified, event_timestamp, properties, unverified_reason, created_at, updated_at
    ) values (
      p_source_key, clean_id, p_state, p_event_type, p_server_modified, now(), p_properties, p_unverified_reason, now(), now()
    );
    applied := true;
  end if;

  -- Maintain cache coherence with notion_pages and activity_cache tables
  if p_state = 'deleted' then
    delete from public.notion_pages where source_key = p_source_key and page_id = clean_id;
    delete from public.activity_cache where source_key = p_source_key and page_id = clean_id;
  elsif p_state = 'active' and p_properties is not null then
    update public.notion_pages
    set data = data || p_properties,
        updated_at = now()
    where source_key = p_source_key and page_id = clean_id;

    update public.activity_cache
    set data = data || p_properties,
        updated_at = now()
    where source_key = p_source_key and page_id = clean_id;
  end if;

  return jsonb_build_object(
    'applied', applied,
    'page_id', clean_id,
    'state', p_state,
    'server_modified', p_server_modified
  );
end;
$$;

create or replace function public.get_recent_notion_page_events(
  p_source_key text,
  p_since timestamptz default null,
  p_limit integer default 200
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'page_id', page_id,
      'state', state,
      'event_type', event_type,
      'server_modified', server_modified,
      'properties', properties,
      'unverified_reason', unverified_reason,
      'updated_at', updated_at
    ) order by updated_at asc
  ), '[]'::jsonb)
  into result
  from (
    select *
    from public.notion_page_events
    where source_key = p_source_key
      and (p_since is null or updated_at > p_since)
    order by updated_at asc
    limit coalesce(p_limit, 200)
  ) sub;

  return result;
end;
$$;

revoke all on function public.record_notion_page_event(text,text,text,text,timestamptz,jsonb,text) from public, anon, authenticated;
grant execute on function public.record_notion_page_event(text,text,text,text,timestamptz,jsonb,text) to service_role;

revoke all on function public.get_recent_notion_page_events(text,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.get_recent_notion_page_events(text,timestamptz,integer) to service_role, authenticated;

commit;

-- ==========================================
-- ANFETA: Creación de perfiles de equipo iniciales
-- ==========================================
DO $$
DECLARE
  v_tag text;
  v_email text;
  v_user_id uuid;
  v_tags text[] := ARRAY['jjohn','nneft','kkarl','iisai','ssote','aacal','aandr','bbria','ggena','eemma'];
BEGIN
  FOREACH v_tag IN ARRAY v_tags LOOP
    v_email := 'anfeta-persona-' || v_tag || '@internal.anfeta.invalid';
    
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
      ) VALUES (
        v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        v_email, crypt('anfeta_internal_auto_pwd_2026', gen_salt('bf')), now(),
        now(), now(), '{"provider":"email","providers":["email"]}', '{}', false
      );
    END IF;
    
    INSERT INTO public.profiles (id, person_tag, login_email, active)
    VALUES (v_user_id, v_tag, v_email, true)
    ON CONFLICT (person_tag) DO UPDATE SET active = true, login_email = excluded.login_email;
    
    INSERT INTO public.user_preferences (user_id)
    VALUES (v_user_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
