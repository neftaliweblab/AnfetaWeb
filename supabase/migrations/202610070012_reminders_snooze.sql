begin;
create or replace function public.snooze_reminder(p_actor uuid,p_id uuid,p_revision integer,p_minutes integer)
returns public.reminders language plpgsql security definer set search_path='' as $$
declare item public.reminders; destination timestamp;
begin
 if not exists(select 1 from public.profiles where id=p_actor and active) then raise exception 'inactive_profile';end if;
 if p_minutes not in(15,60,1440) then raise exception 'invalid_delay';end if;
 select * into item from public.reminders where id=p_id for update;
 if item.id is null or (item.creator_id<>p_actor and item.assignee_id<>p_actor) then raise exception 'reminder_not_available';end if;
 if item.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
 if item.completed then raise exception 'completed_reminder';end if;
 destination:=greatest(item.due_date+item.due_time,now() at time zone 'America/Mexico_City')+make_interval(mins=>p_minutes);
 update public.reminders set due_date=destination::date,due_time=date_trunc('minute',destination)::time,revision=revision+1,updated_at=now() where id=p_id returning * into item;
 return item;
end;$$;
revoke all on function public.snooze_reminder(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.snooze_reminder(uuid,uuid,integer,integer) to service_role;
commit;
