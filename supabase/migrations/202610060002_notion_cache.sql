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
