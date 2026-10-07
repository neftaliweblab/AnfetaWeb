-- ANFETA: instalación inicial, solo para proyecto nuevo sin migraciones ANFETA.
-- Ejecutar una sola vez en Supabase SQL Editor. No contiene claves ni contraseñas.
-- Después crear usuarios en Authentication y vincular sus perfiles.
BEGIN;

-- 202610060001_accounts_preferences.sql
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


-- 202610060002_notion_cache.sql
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


-- 202610060003_reminders.sql
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


-- 202610060004_presence.sql
begin;
create table public.team_presence(user_id uuid primary key references public.profiles(id) on delete cascade,last_seen timestamptz not null default now());
alter table public.team_presence enable row level security;
create policy team_presence_active on public.team_presence for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and active));
grant select on public.team_presence to authenticated;grant all on public.team_presence to service_role;
commit;


-- 202610060005_messages.sql
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


-- 202610060006_automation_jobs.sql
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


-- 202610060007_checklist_history.sql
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


-- 202610060008_pending_preferences.sql
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

COMMIT;
