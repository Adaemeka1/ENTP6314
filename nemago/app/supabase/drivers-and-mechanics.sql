-- NemaGo drivers and mechanics tables.
-- Run this AFTER schema.sql: SQL Editor -> New query -> paste -> Run.
-- It is safe to run more than once.
--
-- A person's name lives in profiles.full_name (from schema.sql), so we don't
-- copy it here. These two tables hold the extra details for each role.

-- ---------------------------------------------------------------------
-- Drivers
-- ---------------------------------------------------------------------
create table if not exists public.drivers (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Mechanics
-- ---------------------------------------------------------------------
create table if not exists public.mechanics (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),

  -- Certification: what the mechanic tells us. Staff check it later (F7).
  certification_name text,            -- for example 'ASE A1-A8'
  certification_number text,
  certification_expires_on date,

  -- Monthly platform subscription (placeholder price, see lib/fees.ts).
  -- Only staff or a payment webhook can change these, never the mechanic.
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'past_due', 'canceled')),
  subscription_renews_on date,

  -- Where the mechanic works. This is a service area, not live GPS: the PRD
  -- says a mechanic's live location is used live and never saved.
  service_city text,
  service_zip text,
  service_radius_miles integer
    check (service_radius_miles is null or service_radius_miles between 1 and 100),

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Every profile gets a matching empty row for its role.
-- ---------------------------------------------------------------------
create or replace function public.create_role_row()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.role = 'driver' then
    insert into public.drivers (id) values (new.id) on conflict do nothing;
  elsif new.role = 'mechanic' then
    insert into public.mechanics (id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.create_role_row();

-- People who signed up before this file was run get their rows now.
insert into public.drivers (id)
  select id from public.profiles where role = 'driver'
  on conflict do nothing;
insert into public.mechanics (id)
  select id from public.profiles where role = 'mechanic'
  on conflict do nothing;

-- ---------------------------------------------------------------------
-- Security: Row Level Security
-- Rows are only created by the trigger above, so there is no insert policy.
-- There is no delete policy either: rows go away with the profile.
-- ---------------------------------------------------------------------
alter table public.drivers enable row level security;
alter table public.mechanics enable row level security;

drop policy if exists "Read own driver details" on public.drivers;
create policy "Read own driver details"
  on public.drivers for select
  using (auth.uid() = id);

drop policy if exists "Update own driver details" on public.drivers;
create policy "Update own driver details"
  on public.drivers for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Read own mechanic details" on public.mechanics;
create policy "Read own mechanic details"
  on public.mechanics for select
  using (auth.uid() = id);

drop policy if exists "Update own mechanic details" on public.mechanics;
create policy "Update own mechanic details"
  on public.mechanics for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Signed-in users can read their own rows (the policies above limit it to their own).
grant select on public.drivers, public.mechanics to authenticated;

-- Column limits: people can edit their own contact and service details, but
-- NOT subscription_status or subscription_renews_on.
revoke update on public.drivers from anon, authenticated;
grant update (phone) on public.drivers to authenticated;

revoke update on public.mechanics from anon, authenticated;
grant update (
  phone,
  certification_name,
  certification_number,
  certification_expires_on,
  service_city,
  service_zip,
  service_radius_miles
) on public.mechanics to authenticated;
