-- Run once in SQL Editor. Read-only; avoids reading page bodies or private Auth data.
select schemaname,relname as tabla,pg_size_pretty(pg_total_relation_size(relid)) as tamano,
 n_live_tup as filas_estimadas,n_dead_tup as filas_muertas_estimadas,last_autovacuum,last_autoanalyze
from pg_stat_user_tables where schemaname in ('public','auth')
order by pg_total_relation_size(relid) desc limit 12;

select state,wait_event_type,wait_event,count(*) as conexiones,
 max(now()-query_start) as mayor_duracion
from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()
group by state,wait_event_type,wait_event order by conexiones desc;

select status,count(*) as ejecuciones from public.sync_runs group by status;

-- The payloads/chunks themselves are not loaded here.
select request_key,count(*) as copias,max(updated_at) as ultima_copia
from public.notion_snapshots group by request_key order by copias desc limit 15;
