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

