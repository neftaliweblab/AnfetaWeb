begin;
create table public.checklist_marks(source_key text not null,page_id text not null,block_id text not null,checked boolean not null,marked_at timestamptz,marking_source text not null default 'unknown' check(marking_source in ('unknown','web')),observed_at timestamptz not null default now(),primary key(source_key,page_id,block_id));
create table public.checklist_mark_events(id uuid primary key default gen_random_uuid(),source_key text not null,page_id text not null,block_id text not null,actor_tag text not null,checked boolean not null,changed_at timestamptz not null default now());
alter table public.checklist_marks enable row level security;alter table public.checklist_mark_events enable row level security;
create policy marks_source on public.checklist_marks for select to authenticated using(exists(select 1 from public.notion_snapshots where user_id=auth.uid() and source_key=public.checklist_marks.source_key) and exists(select 1 from public.profiles where id=auth.uid() and active));
create policy events_actor on public.checklist_mark_events for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and person_tag=actor_tag and active));
grant select on public.checklist_marks,public.checklist_mark_events to authenticated;grant all on public.checklist_marks,public.checklist_mark_events to service_role;
create function public.observe_checklist(p_source text,p_page text,p_items jsonb,p_observed_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare entry jsonb;
begin
 for entry in select value from jsonb_array_elements(p_items) loop
  insert into public.checklist_marks(source_key,page_id,block_id,checked,observed_at) values(p_source,p_page,entry->>'id',(entry->>'checked')::boolean,p_observed_at)
  on conflict(source_key,page_id,block_id) do update set checked=excluded.checked,marked_at=case when public.checklist_marks.checked=excluded.checked then public.checklist_marks.marked_at else null end,marking_source=case when public.checklist_marks.checked=excluded.checked then public.checklist_marks.marking_source else 'unknown' end,observed_at=excluded.observed_at where public.checklist_marks.observed_at<=excluded.observed_at;
 end loop;
 return coalesce((select jsonb_agg(to_jsonb(m)) from public.checklist_marks m where source_key=p_source and page_id=p_page),'[]'::jsonb);
end;$$;
create function public.record_checklist_mark(p_source text,p_page text,p_block text,p_actor text,p_previous boolean,p_checked boolean) returns void language plpgsql security definer set search_path='' as $$
declare row public.checklist_marks;
begin
 if not exists(select 1 from public.profiles where person_tag=p_actor and active) then raise exception 'inactive_profile';end if;
 insert into public.checklist_marks(source_key,page_id,block_id,checked) values(p_source,p_page,p_block,p_previous) on conflict do nothing;
 select * into row from public.checklist_marks where source_key=p_source and page_id=p_page and block_id=p_block for update;
 if p_previous<>p_checked and (row.checked<>p_checked or row.marking_source='unknown') then
  insert into public.checklist_mark_events(source_key,page_id,block_id,actor_tag,checked) values(p_source,p_page,p_block,p_actor,p_checked);
  update public.checklist_marks set checked=p_checked,marked_at=case when p_checked then now() else null end,marking_source='web',observed_at=now() where source_key=p_source and page_id=p_page and block_id=p_block;
 end if;
end;$$;
revoke all on function public.observe_checklist(text,text,jsonb,timestamptz),public.record_checklist_mark(text,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.observe_checklist(text,text,jsonb,timestamptz),public.record_checklist_mark(text,text,text,text,boolean,boolean) to service_role;
commit;
