-- NemaGo Smart Dispatch Match (PRD F3): lets the SERVER read which mechanics are
-- eligible for a job, so it can score and rank them for the driver's screen.
-- Run this AFTER schema.sql, drivers-and-mechanics.sql and payments.sql.
-- Safe to run more than once. It changes no tables and no existing rules.
--
-- Drivers cannot read mechanic records (and should not). This function is the
-- only way to list them, it can only be called by the server's secret key, and
-- the server sends the driver's browser just scores and first names of the
-- accepting mechanic, never ids, phone numbers or certification numbers.
-- A mechanic is eligible only if staff verified them AND payouts are set up,
-- the same rules that already decide who can accept a job.

create or replace function public.admin_match_candidates()
returns table (
  mechanic_id uuid,
  first_name text,
  certification_name text,
  certification_expires_on date
)
language sql
stable
security definer set search_path = ''
as $$
  select
    m.id,
    nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''),
    m.certification_name,
    m.certification_expires_on
  from public.mechanics m
  join public.profiles p on p.id = m.id
  where p.role = 'mechanic'
    and p.mechanic_verified
    and m.payouts_enabled;
$$;

revoke all on function public.admin_match_candidates() from public, anon, authenticated;
grant execute on function public.admin_match_candidates() to service_role;
