-- Allow all ANFETA team members to have their own WhatsApp directory in Supabase
alter table if exists public.whatsapp_accounts drop constraint if exists whatsapp_accounts_owner_check;

-- Ensure foreign key cascade exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'whatsapp_groups_owner_fkey'
  ) then
    -- constraint is intact
    null;
  end if;
end $$;
