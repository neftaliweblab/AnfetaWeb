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
  and not exists(select 1 from entries e where e.page_id=n.page_id);
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
