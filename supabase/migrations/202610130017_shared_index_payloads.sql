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

