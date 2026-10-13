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
