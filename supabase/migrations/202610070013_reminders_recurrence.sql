begin;
alter table public.reminders add column if not exists recurrence text not null default 'none' check(recurrence in('none','daily','weekly','monthly'));
alter table public.reminders add column if not exists recurrence_day integer check(recurrence_day between 1 and 31);
alter table public.reminders add column if not exists previous_id uuid references public.reminders(id) on delete set null;
create unique index if not exists reminders_previous_unique on public.reminders(previous_id) where previous_id is not null;

create or replace function public.change_reminder(p_actor uuid,p_action text,p_id uuid,p_revision integer,p_title text,p_date date,p_time time,p_priority text,p_assignee uuid,p_completed boolean)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders; was_completed boolean; next_date date; month_start date; wanted_day integer;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_action='create' then
  if not exists(select 1 from public.profiles where id=p_assignee and active) then raise exception 'inactive_assignee';end if;
  insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority) values(p_actor,p_assignee,p_title,p_date,p_time,p_priority) returning * into item;
 else
  select * into item from public.reminders where id=p_id for update;
  if item.id is null or (item.creator_id<>p_actor and item.assignee_id<>p_actor) then raise exception 'reminder_not_available';end if;
  if item.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
  if p_action='complete' then
   if p_completed is null then raise exception 'invalid_completed';end if;
   was_completed:=item.completed;
   update public.reminders set completed=p_completed,revision=revision+1,updated_at=now() where id=p_id returning * into item;
   if p_completed and not was_completed and item.recurrence<>'none' then
    if item.recurrence='daily' then next_date:=item.due_date+1;
    elsif item.recurrence='weekly' then next_date:=item.due_date+7;
    else
     wanted_day:=coalesce(item.recurrence_day,extract(day from item.due_date)::integer);
     month_start:=(date_trunc('month',item.due_date)+interval '1 month')::date;
     next_date:=month_start+least(wanted_day,extract(day from month_start+interval '1 month - 1 day')::integer)-1;
    end if;
    insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority,recurrence,recurrence_day,previous_id)
     values(item.creator_id,item.assignee_id,item.title,next_date,item.due_time,item.priority,item.recurrence,coalesce(item.recurrence_day,extract(day from item.due_date)::integer),item.id)
     on conflict(previous_id) where previous_id is not null do nothing;
   end if;
  elsif p_action='delete' and item.creator_id=p_actor then delete from public.reminders where id=p_id;
  else raise exception 'action_not_allowed';end if;
 end if;
 return item;
end;$$;

create or replace function public.edit_reminder(p_actor uuid,p_action text,p_id uuid,p_revision integer,p_title text,p_date date,p_time time,p_priority text,p_assignee uuid,p_recurrence text)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_recurrence is null or p_recurrence not in('none','daily','weekly','monthly') or p_title is null or length(trim(p_title)) not between 1 and 500 or p_date is null or p_time is null or p_priority is null or p_priority not in('low','medium','high','urgent') then raise exception 'invalid_reminder';end if;
 if not exists(select 1 from public.profiles where id=p_assignee and active) then raise exception 'inactive_assignee';end if;
 if p_action='create' then
  insert into public.reminders(creator_id,assignee_id,title,due_date,due_time,priority,recurrence,recurrence_day) values(p_actor,p_assignee,trim(p_title),p_date,p_time,p_priority,p_recurrence,extract(day from p_date)::integer) returning * into item;
 elsif p_action='edit' then
  select * into item from public.reminders where id=p_id for update;
  if item.id is null or item.creator_id<>p_actor then raise exception 'reminder_not_available';end if;
  if item.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
  if item.completed then raise exception 'completed_reminder';end if;
  update public.reminders set title=trim(p_title),due_date=p_date,due_time=p_time,priority=p_priority,assignee_id=p_assignee,recurrence=p_recurrence,recurrence_day=case when due_date=p_date then coalesce(recurrence_day,extract(day from p_date)::integer) else extract(day from p_date)::integer end,revision=revision+1,updated_at=now() where id=p_id returning * into item;
 else raise exception 'action_not_allowed';end if;
 return item;
end;$$;
revoke all on function public.edit_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,text) from public,anon,authenticated;
grant execute on function public.edit_reminder(uuid,text,uuid,integer,text,date,time,text,uuid,text) to service_role;
commit;
