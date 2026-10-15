-- Historical visual copies reference the original Notion page; never duplicate it.
create table if not exists public.activity_handoffs (
 id uuid primary key,
 source_key text not null,
 page_id text not null,
 from_person text not null,
 to_person text not null,
 actor text not null,
 note text not null default '',
 snapshot jsonb not null,
 leave_copy boolean not null default true,
 confirmed boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists activity_handoffs_source_date on public.activity_handoffs(source_key, ((snapshot->>'start')));
alter table public.activity_handoffs enable row level security;
revoke all on public.activity_handoffs from anon, authenticated;
grant all on public.activity_handoffs to service_role;
