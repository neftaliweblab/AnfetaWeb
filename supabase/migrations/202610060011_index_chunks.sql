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
