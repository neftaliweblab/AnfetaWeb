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
