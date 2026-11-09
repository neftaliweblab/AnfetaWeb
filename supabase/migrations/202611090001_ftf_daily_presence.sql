begin;

create table if not exists public.ftf_daily_presence (
  day date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  primary key (day, user_id),
  check (last_seen >= first_seen)
);

alter table public.ftf_daily_presence enable row level security;
revoke all on public.ftf_daily_presence from public, anon, authenticated;
grant select, insert, update on public.ftf_daily_presence to service_role;

create or replace function public.record_ftf_daily_presence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.last_seen is not distinct from old.last_seen then
      return new;
    end if;
  end if;

  insert into public.ftf_daily_presence as daily (day, user_id, first_seen, last_seen)
  values ((new.last_seen at time zone 'America/Mexico_City')::date, new.user_id, new.last_seen, new.last_seen)
  on conflict (day, user_id) do update
    set first_seen = least(daily.first_seen, excluded.first_seen),
        last_seen = greatest(daily.last_seen, excluded.last_seen);
  return new;
end;
$$;

revoke all on function public.record_ftf_daily_presence() from public, anon, authenticated;

drop trigger if exists record_ftf_daily_presence on public.team_presence;
create trigger record_ftf_daily_presence
after insert or update of last_seen on public.team_presence
for each row execute function public.record_ftf_daily_presence();

notify pgrst, 'reload schema';

commit;
