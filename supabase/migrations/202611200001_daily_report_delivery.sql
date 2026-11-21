begin;
create table if not exists public.daily_report_deliveries(
 key text primary key, report_date date not null, recipients jsonb not null,
 state text not null check(state in ('generating','sending','sent','failed','uncertain')),
 token uuid not null, attempts integer not null default 1, lease_until timestamptz not null,
 snapshot jsonb, result jsonb, history jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.daily_report_deliveries enable row level security;
revoke all on public.daily_report_deliveries from public,anon,authenticated;
grant all on public.daily_report_deliveries to service_role;
create or replace function public.claim_daily_report(p_key text,p_date date,p_to jsonb,p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.daily_report_deliveries;
begin
 if p_key !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_to)<>'array' or p_date is null or p_token is null then raise exception 'invalid_report_claim';end if;
 insert into public.daily_report_deliveries(key,report_date,recipients,state,token,lease_until,history)
 values(p_key,p_date,p_to,'generating',p_token,now()+interval '5 minutes',jsonb_build_array(jsonb_build_object('state','generating','at',now(),'attempt',1))) on conflict do nothing;
 if found then return jsonb_build_object('state','claimed','attempts',1);end if;
 select * into item from public.daily_report_deliveries where key=p_key for update;
 if item.state='sending' and item.lease_until<now() then
   update public.daily_report_deliveries set state='uncertain',updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('state','uncertain','at',now(),'reason','expired_sending_lease')) where key=p_key;
   return jsonb_build_object('state','uncertain','attempts',item.attempts);
 end if;
 if (item.state='generating' and item.lease_until<now() or item.state='failed' and item.updated_at<now()-interval '15 minutes') and item.attempts<3 then
  update public.daily_report_deliveries set state='generating',token=p_token,attempts=attempts+1,lease_until=now()+interval '5 minutes',updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('state','generating','at',now(),'attempt',attempts+1)) where key=p_key;
  return jsonb_build_object('state','claimed','attempts',item.attempts+1);
 end if;
 return jsonb_build_object('state',case when item.state in ('generating','sending') then 'busy' else item.state end,'attempts',item.attempts);
end;$$;
create or replace function public.finish_daily_report(p_key text,p_token uuid,p_state text,p_payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('sending','sent','failed','uncertain') then raise exception 'invalid_report_state';end if;
 update public.daily_report_deliveries set state=p_state,
 snapshot=case when p_state='sending' then p_payload else snapshot end,
 result=case when p_state='sending' then null else p_payload end,
 lease_until=now()+interval '5 minutes',updated_at=now(),
 history=history||jsonb_build_array(jsonb_build_object('state',p_state,'at',now(),'result',case when p_state='sending' then null else p_payload end))
 where key=p_key and token=p_token and (
   state='generating' and p_state in ('sending','failed') or
   state='sending' and p_state in ('sent','failed','uncertain')
 );
 return found;
end;$$;
revoke all on function public.claim_daily_report(text,date,jsonb,uuid),public.finish_daily_report(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_daily_report(text,date,jsonb,uuid),public.finish_daily_report(text,uuid,text,jsonb) to service_role;
commit;
