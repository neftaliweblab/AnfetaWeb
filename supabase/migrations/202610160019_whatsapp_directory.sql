-- Private server-only directory. WhatsApp session credentials never enter Supabase.
create table if not exists public.whatsapp_accounts (
 owner text primary key check (owner = 'John'),
 account_key text not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_groups (
 owner text not null references public.whatsapp_accounts(owner),
 group_id text not null check (group_id ~ '^[0-9]+(-[0-9]+)?@g\.us$'),
 name text not null check (length(name) between 1 and 1024),
 access_url text,
 last_seen_at timestamptz not null default now(),
 primary key(owner, group_id)
);
create table if not exists public.whatsapp_activity_links (
 owner text not null,
 group_id text not null,
 page_id text not null check (length(page_id) between 1 and 64),
 activity_title text not null check (length(activity_title) between 1 and 2048),
 created_at timestamptz not null default now(),
 primary key(owner, group_id, page_id),
 foreign key(owner, group_id) references public.whatsapp_groups(owner, group_id) on delete cascade
);
alter table public.whatsapp_accounts enable row level security;
alter table public.whatsapp_groups enable row level security;
alter table public.whatsapp_activity_links enable row level security;
revoke all on public.whatsapp_accounts, public.whatsapp_groups, public.whatsapp_activity_links from anon, authenticated;
grant all on public.whatsapp_accounts, public.whatsapp_groups, public.whatsapp_activity_links to service_role;

create or replace function public.import_anfeta_whatsapp_groups(p_account_key text, p_groups jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare existing_key text; imported integer;
begin
 perform pg_advisory_xact_lock(hashtext('anfeta-whatsapp-John'));
 if length(p_account_key) <> 64 or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) > 50 then
   raise exception 'invalid_import';
 end if;
 select account_key into existing_key from public.whatsapp_accounts where owner = 'John';
 if existing_key is not null and existing_key <> p_account_key then raise exception 'different_whatsapp_account'; end if;
 insert into public.whatsapp_accounts(owner,account_key) values('John',p_account_key)
 on conflict(owner) do update set updated_at = now();
 insert into public.whatsapp_groups(owner, group_id, name)
 select 'John', item->>'id', item->>'name' from jsonb_array_elements(p_groups) item
 on conflict(owner,group_id) do update set name = excluded.name, last_seen_at = now();
 get diagnostics imported = row_count;
 return imported;
end $$;
revoke all on function public.import_anfeta_whatsapp_groups(text,jsonb) from public, anon, authenticated;
grant execute on function public.import_anfeta_whatsapp_groups(text,jsonb) to service_role;
