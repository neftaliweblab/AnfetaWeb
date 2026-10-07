begin;
create table public.reminders (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id), assignee_id uuid not null references public.profiles(id),
 title text not null check(length(trim(title)) between 1 and 500), due_date date not null, due_time time not null,
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')), completed boolean not null default false,
 revision integer not null default 1, updated_at timestamptz not null default now()
);
create index reminders_assignee_date on public.reminders(assignee_id,due_date);
alter table public.reminders enable row level security;
create policy reminders_own_read on public.reminders for select to authenticated using((creator_id=auth.uid() or assignee_id=auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and active));
grant select on public.reminders to authenticated;grant all on public.reminders to service_role;
create function public.change_reminder(p_actor uuid,p_action text,p_id uuid,p_revision integer,p_title text,p_date date,p_time time,p_priority text,p_assignee uuid,p_completed boolean)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_action='create' then
  if not exists(select 1 from public.profiles where id=p_assignee and active) then raise exception 'inactive_assignee';end if;
  insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority) values(p_actor,p_assignee,p_title,p_date,p_time,p_priority) returning * into item;
 else
  select * into item from public.reminders where id=p_id for update;
  if item.id is null or (item.creator_id<>p_actor and item.assignee_id<>p_actor) then raise exception 'reminder_not_available';end if;
  if item.revision<>p_revision then raise exception 'revision_conflict';end if;
  if p_action='complete' then update public.reminders set completed=p_completed,revision=revision+1,updated_at=now() where id=p_id returning * into item;
  elsif p_action='delete' and item.creator_id=p_actor then delete from public.reminders where id=p_id;
  else raise exception 'action_not_allowed';end if;
 end if;return item;
end;$$;
revoke all on function public.change_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.change_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,boolean) to service_role;
commit;
