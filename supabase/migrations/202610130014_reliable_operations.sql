begin;
create table if not exists public.activity_leases(key text primary key,token uuid not null,expires_at timestamptz not null);
create table if not exists public.delivery_receipts(key text primary key,token uuid not null,state text not null check(state in ('running','done','uncertain')),result jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.activity_leases enable row level security;
alter table public.delivery_receipts enable row level security;
revoke all on public.activity_leases,public.delivery_receipts from anon,authenticated;
create or replace function public.claim_activity_lease(p_key text,p_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_leases(key,token,expires_at) values(p_key,p_token,now()+interval '5 minutes') on conflict(key) do update set token=excluded.token,expires_at=excluded.expires_at where public.activity_leases.expires_at<now();
 return found;
end;$$;
create or replace function public.release_activity_lease(p_key text,p_token uuid) returns void language sql security definer set search_path='' as $$ delete from public.activity_leases where key=p_key and token=p_token; $$;
create or replace function public.claim_delivery(p_key text,p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.delivery_receipts;
begin
 insert into public.delivery_receipts(key,token,state) values(p_key,p_token,'running') on conflict do nothing;
 if found then return jsonb_build_object('state','claimed'); end if;
 select * into item from public.delivery_receipts where key=p_key;
 return jsonb_build_object('state',item.state,'result',item.result);
end;$$;
create or replace function public.finish_delivery(p_key text,p_token uuid,p_result jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.delivery_receipts set state='done',result=p_result,updated_at=now() where key=p_key and token=p_token and state='running';
 if not found then raise exception 'operation_not_owned';end if;
end;$$;
create or replace function public.uncertain_delivery(p_key text,p_token uuid) returns void language sql security definer set search_path='' as $$ update public.delivery_receipts set state='uncertain',updated_at=now() where key=p_key and token=p_token and state='running'; $$;
revoke all on function public.claim_activity_lease(text,uuid),public.release_activity_lease(text,uuid),public.claim_delivery(text,uuid),public.finish_delivery(text,uuid,jsonb),public.uncertain_delivery(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_activity_lease(text,uuid),public.release_activity_lease(text,uuid),public.claim_delivery(text,uuid),public.finish_delivery(text,uuid,jsonb),public.uncertain_delivery(text,uuid) to service_role;
commit;
