begin;

create table if not exists public.notion_page_events (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  page_id text not null,
  state text not null check(state in ('deleted', 'active', 'unverified')),
  event_type text not null check(event_type in ('page.deleted', 'page.undeleted', 'page.properties_updated', 'page.content_updated', 'page.created', 'manual_delete', 'manual_restore', 'polled_state')),
  server_modified timestamptz not null default now(),
  event_timestamp timestamptz not null default now(),
  properties jsonb,
  unverified_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notion_page_events_source_page_key unique (source_key, page_id)
);

create index if not exists idx_notion_page_events_source_updated
  on public.notion_page_events (source_key, updated_at desc);

create index if not exists idx_notion_page_events_page_id
  on public.notion_page_events (page_id);

alter table public.notion_page_events enable row level security;

revoke all on public.notion_page_events from anon, authenticated;
grant select on public.notion_page_events to authenticated;
grant all on public.notion_page_events to service_role;

create policy select_notion_page_events on public.notion_page_events
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active));

create or replace function public.record_notion_page_event(
  p_source_key text,
  p_page_id text,
  p_state text,
  p_event_type text,
  p_server_modified timestamptz,
  p_properties jsonb default null,
  p_unverified_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_found boolean := false;
  v_state text;
  v_modified timestamptz;
  v_props jsonb;
  applied boolean := false;
  clean_id text := lower(replace(p_page_id, '-', ''));
begin
  select true, state, server_modified, properties
  into v_found, v_state, v_modified, v_props
  from public.notion_page_events
  where source_key = p_source_key and page_id = clean_id
  for update;

  if v_found then
    -- Monotonic protection: If incoming event is strictly older than existing, ignore it!
    if p_server_modified < v_modified then
      return jsonb_build_object(
        'applied', false,
        'reason', 'stale_event',
        'current_state', v_state,
        'current_modified', v_modified
      );
    end if;

    update public.notion_page_events
    set state = p_state,
        event_type = p_event_type,
        server_modified = p_server_modified,
        event_timestamp = now(),
        properties = coalesce(p_properties, case when p_state = 'deleted' then null else v_props end),
        unverified_reason = p_unverified_reason,
        updated_at = now()
    where source_key = p_source_key and page_id = clean_id;
    applied := true;
  else
    insert into public.notion_page_events (
      source_key, page_id, state, event_type, server_modified, event_timestamp, properties, unverified_reason, created_at, updated_at
    ) values (
      p_source_key, clean_id, p_state, p_event_type, p_server_modified, now(), p_properties, p_unverified_reason, now(), now()
    );
    applied := true;
  end if;

  -- Maintain cache coherence with notion_pages and activity_cache tables
  if p_state = 'deleted' then
    delete from public.notion_pages where source_key = p_source_key and page_id = clean_id;
    delete from public.activity_cache where source_key = p_source_key and page_id = clean_id;
  elsif p_state = 'active' and p_properties is not null then
    update public.notion_pages
    set data = data || p_properties,
        updated_at = now()
    where source_key = p_source_key and page_id = clean_id;

    update public.activity_cache
    set data = data || p_properties,
        updated_at = now()
    where source_key = p_source_key and page_id = clean_id;
  end if;

  return jsonb_build_object(
    'applied', applied,
    'page_id', clean_id,
    'state', p_state,
    'server_modified', p_server_modified
  );
end;
$$;

create or replace function public.get_recent_notion_page_events(
  p_source_key text,
  p_since timestamptz default null,
  p_limit integer default 200
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'page_id', page_id,
      'state', state,
      'event_type', event_type,
      'server_modified', server_modified,
      'properties', properties,
      'unverified_reason', unverified_reason,
      'updated_at', updated_at
    ) order by updated_at asc
  ), '[]'::jsonb)
  into result
  from (
    select *
    from public.notion_page_events
    where source_key = p_source_key
      and (p_since is null or updated_at > p_since)
    order by updated_at asc
    limit coalesce(p_limit, 200)
  ) sub;

  return result;
end;
$$;

revoke all on function public.record_notion_page_event(text,text,text,text,timestamptz,jsonb,text) from public, anon, authenticated;
grant execute on function public.record_notion_page_event(text,text,text,text,timestamptz,jsonb,text) to service_role;

revoke all on function public.get_recent_notion_page_events(text,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.get_recent_notion_page_events(text,timestamptz,integer) to service_role, authenticated;

commit;
