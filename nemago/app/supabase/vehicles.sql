-- NemaGo vehicles (PRD F1): the cars a driver has saved.
-- Run this AFTER schema.sql and drivers-and-mechanics.sql. Safe to run more than once.
--
-- Rules, in plain words:
--   * A driver can see, add, edit and delete ONLY their own vehicles.
--   * Mechanics, other drivers and signed-out visitors cannot read or change them.
--   * A driver can save at most 10 vehicles.
--   * Only year, make, model and mileage can be edited (never who owns the car).
-- It changes no existing table, payment or dispatch rule.

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  year integer not null check (year between 1980 and 2100),
  make text not null check (char_length(btrim(make)) between 1 and 40),
  model text not null check (char_length(btrim(model)) between 1 and 60),
  -- Current mileage. (The PRD's "mileage over time" history comes later.)
  mileage integer not null check (mileage between 0 and 999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_driver_idx on public.vehicles (driver_id);

-- ---------------------------------------------------------------------
-- Housekeeping triggers: tidy the text, stamp the edit time, cap at 10 cars.
-- ---------------------------------------------------------------------
create or replace function public.vehicles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.make := btrim(new.make);
  new.model := btrim(new.model);

  if tg_op = 'INSERT' then
    if (select count(*) from public.vehicles where driver_id = new.driver_id) >= 10 then
      raise exception 'vehicle_limit';
    end if;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_before_write on public.vehicles;
create trigger vehicles_before_write
  before insert or update on public.vehicles
  for each row execute function public.vehicles_before_write();

-- ---------------------------------------------------------------------
-- Security: Row Level Security, plus the permissions newer Supabase
-- projects don't hand out automatically.
-- ---------------------------------------------------------------------
alter table public.vehicles enable row level security;

revoke all on public.vehicles from anon, authenticated;
grant select, insert, delete on public.vehicles to authenticated;
grant update (year, make, model, mileage) on public.vehicles to authenticated;

drop policy if exists "Drivers read own vehicles" on public.vehicles;
create policy "Drivers read own vehicles"
  on public.vehicles for select
  using (driver_id = auth.uid());

drop policy if exists "Drivers add own vehicles" on public.vehicles;
create policy "Drivers add own vehicles"
  on public.vehicles for insert
  with check (driver_id = auth.uid());

drop policy if exists "Drivers edit own vehicles" on public.vehicles;
create policy "Drivers edit own vehicles"
  on public.vehicles for update
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists "Drivers delete own vehicles" on public.vehicles;
create policy "Drivers delete own vehicles"
  on public.vehicles for delete
  using (driver_id = auth.uid());
