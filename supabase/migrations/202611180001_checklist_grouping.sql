begin;
alter table public.checklist_marks add column if not exists planned_date date, add column if not exists planned_by text, add column if not exists planned_updated_at timestamptz;
create table if not exists public.checklist_date_groups(
 source_key text not null,page_id text not null,planned_date date not null,toggle_id text,state text not null check(state in ('creating','ready')),primary key(source_key,page_id,planned_date)
);
create table if not exists public.checklist_group_moves(
 id uuid primary key default gen_random_uuid(),source_key text not null,page_id text not null,old_block_id text not null,
 target_id text not null,planned_date date,actor text not null,source_version text not null,backup jsonb not null,
 state text not null check(state in ('prepared','creating','copied','verified','migrated','done')),new_ids jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(source_key,page_id,old_block_id)
);
alter table public.checklist_date_groups enable row level security;
alter table public.checklist_group_moves enable row level security;
revoke all on public.checklist_date_groups,public.checklist_group_moves from public,anon,authenticated;
grant all on public.checklist_date_groups,public.checklist_group_moves to service_role;
create or replace function public.migrate_grouped_checklist(p_move uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare op public.checklist_group_moves; entry jsonb; oldrow public.checklist_marks; newrow public.checklist_marks; desired boolean;
begin
 select * into op from public.checklist_group_moves where id=p_move for update;
 if not found then raise exception 'group_move_missing';end if;
 if op.state in ('migrated','done') then return true;end if;
 if op.state<>'verified' or jsonb_typeof(op.new_ids)<>'array' then raise exception 'copy_not_confirmed';end if;
 for entry in select value from jsonb_array_elements(op.new_ids) loop
  if entry->>'kind'<>'to_do' then continue;end if;
  if entry->>'oldId' !~ '^[a-f0-9]{32}$' or entry->>'newId' !~ '^[a-f0-9]{32}$' or entry->>'oldId'=entry->>'newId' then raise exception 'invalid_group_mapping';end if;
  desired=(entry->>'checked')::boolean;
  select * into oldrow from public.checklist_marks where source_key=op.source_key and page_id=op.page_id and block_id=entry->>'oldId' for update;
  select * into newrow from public.checklist_marks where source_key=op.source_key and page_id=op.page_id and block_id=entry->>'newId' for update;
  if found and newrow.checked<>desired then raise exception 'copy_changed';end if;
  insert into public.checklist_marks(source_key,page_id,block_id,checked,marked_at,marking_source,observed_at,planned_date,planned_by,planned_updated_at)
  values(op.source_key,op.page_id,entry->>'newId',desired,
   case when oldrow.checked=desired then oldrow.marked_at end,
   case when oldrow.checked=desired then oldrow.marking_source else 'unknown' end,
   coalesce(oldrow.observed_at,now()),nullif(entry->>'plannedDate','')::date,oldrow.planned_by,oldrow.planned_updated_at)
  on conflict(source_key,page_id,block_id) do update set checked=excluded.checked,marked_at=excluded.marked_at,marking_source=excluded.marking_source,planned_date=excluded.planned_date,planned_by=excluded.planned_by,planned_updated_at=excluded.planned_updated_at;
  update public.checklist_mark_events set block_id=entry->>'newId' where source_key=op.source_key and page_id=op.page_id and block_id=entry->>'oldId';
 end loop;
 update public.checklist_group_moves set state='migrated',updated_at=now() where id=p_move;
 return true;
end;$$;
create or replace function public.finish_checklist_group_move(p_move uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare op public.checklist_group_moves; entry jsonb;
begin
 select * into op from public.checklist_group_moves where id=p_move for update;
 if not found or op.state not in ('migrated','done') then raise exception 'group_move_not_migrated';end if;
 for entry in select value from jsonb_array_elements(op.new_ids) loop
  delete from public.checklist_marks where source_key=op.source_key and page_id=op.page_id and block_id=entry->>'oldId';
 end loop;
 update public.checklist_group_moves set state='done',updated_at=now() where id=p_move;
 return true;
end;$$;
revoke all on function public.migrate_grouped_checklist(uuid),public.finish_checklist_group_move(uuid) from public,anon,authenticated;
grant execute on function public.migrate_grouped_checklist(uuid),public.finish_checklist_group_move(uuid) to service_role;
commit;
