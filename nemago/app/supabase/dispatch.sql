-- NemaGo dispatch: a driver asks for help, a verified mechanic accepts it.
-- Run this AFTER schema.sql and drivers-and-mechanics.sql:
-- SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- How it works:
--   * Nobody writes to these tables directly. Drivers and mechanics call the
--     three functions at the bottom, which check the rules.
--   * Anyone can READ only what the rules below allow.
--   * The tables are added to Supabase Realtime, so screens update instantly.

-- ---------------------------------------------------------------------
-- The request itself (what a mechanic sees BEFORE accepting)
-- ---------------------------------------------------------------------
create table if not exists public.dispatch_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  -- What the driver says is wrong. It is erased when the request is cancelled,
  -- because the PRD only keeps descriptions for training with consent.
  problem text check (problem is null or char_length(problem) between 3 and 500),
  -- A general area like "Downtown Austin". The street address is kept apart.
  area text not null check (char_length(area) between 2 and 80),
  status text not null default 'open' check (status in ('open', 'accepted', 'cancelled')),
  mechanic_id uuid references public.mechanics (id) on delete set null,
  mechanic_first_name text,
  -- The mechanic types this in when they accept. We have no live location yet.
  eta_minutes integer check (eta_minutes is null or eta_minutes between 5 and 180),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- A driver can only have one open or accepted request at a time.
create unique index if not exists one_active_request_per_driver
  on public.dispatch_requests (driver_id)
  where status in ('open', 'accepted');

-- ---------------------------------------------------------------------
-- The private part: street address and the driver's first name.
-- Only the driver and the mechanic who accepted can read it.
-- (The PRD keeps the job address but never live GPS.)
-- ---------------------------------------------------------------------
create table if not exists public.dispatch_contacts (
  request_id uuid primary key references public.dispatch_requests (id) on delete cascade,
  driver_first_name text,
  address text not null check (char_length(address) between 3 and 200)
);

-- ---------------------------------------------------------------------
-- Is the person asking a mechanic that staff have verified? (PRD F7)
-- ---------------------------------------------------------------------
create or replace function public.is_verified_mechanic()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'mechanic' and mechanic_verified
  );
$$;

revoke all on function public.is_verified_mechanic() from public, anon;
grant execute on function public.is_verified_mechanic() to authenticated;

-- ---------------------------------------------------------------------
-- Who can read what (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.dispatch_requests enable row level security;
alter table public.dispatch_contacts enable row level security;

revoke all on public.dispatch_requests, public.dispatch_contacts from anon, authenticated;
grant select on public.dispatch_requests, public.dispatch_contacts to authenticated;

drop policy if exists "Drivers read their own requests" on public.dispatch_requests;
create policy "Drivers read their own requests"
  on public.dispatch_requests for select
  using (driver_id = auth.uid());

-- A verified mechanic sees open requests, plus the ones they accepted.
drop policy if exists "Verified mechanics read open and their own requests" on public.dispatch_requests;
create policy "Verified mechanics read open and their own requests"
  on public.dispatch_requests for select
  using (
    public.is_verified_mechanic()
    and (status = 'open' or mechanic_id = auth.uid())
  );

drop policy if exists "Drivers read their own contact details" on public.dispatch_contacts;
create policy "Drivers read their own contact details"
  on public.dispatch_contacts for select
  using (
    exists (
      select 1 from public.dispatch_requests r
      where r.id = request_id and r.driver_id = auth.uid()
    )
  );

drop policy if exists "Accepting mechanic reads contact details" on public.dispatch_contacts;
create policy "Accepting mechanic reads contact details"
  on public.dispatch_contacts for select
  using (
    public.is_verified_mechanic()
    and exists (
      select 1 from public.dispatch_requests r
      where r.id = request_id and r.mechanic_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- The three actions. These are the ONLY way to change a request.
-- ---------------------------------------------------------------------

-- A driver asks for a mechanic.
create or replace function public.request_dispatch(p_problem text, p_area text, p_address text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1) into v_name
    from public.profiles
    where id = auth.uid() and role = 'driver';
  if not found then
    raise exception 'not_a_driver';
  end if;

  if exists (
    select 1 from public.dispatch_requests
    where driver_id = auth.uid() and status in ('open', 'accepted')
  ) then
    raise exception 'already_active';
  end if;

  insert into public.dispatch_requests (driver_id, problem, area)
    values (auth.uid(), trim(p_problem), trim(p_area))
    returning id into v_id;

  insert into public.dispatch_contacts (request_id, driver_first_name, address)
    values (v_id, nullif(v_name, ''), trim(p_address));

  return v_id;
end;
$$;

-- A verified mechanic takes an open request. The first one to ask wins.
create or replace function public.accept_dispatch(p_request_id uuid, p_eta_minutes integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_name text;
begin
  if not public.is_verified_mechanic() then
    raise exception 'not_verified';
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1) into v_name
    from public.profiles where id = auth.uid();

  -- "where status = 'open'" is what makes it first come, first served: if
  -- another mechanic got there a moment earlier, no row matches.
  update public.dispatch_requests
    set status = 'accepted',
        mechanic_id = auth.uid(),
        mechanic_first_name = nullif(v_name, ''),
        eta_minutes = p_eta_minutes,
        accepted_at = now()
    where id = p_request_id and status = 'open';

  if not found then
    raise exception 'already_taken';
  end if;
end;
$$;

-- A driver cancels their own request. The description is erased.
create or replace function public.cancel_dispatch(p_request_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.dispatch_requests
    set status = 'cancelled', problem = null
    where id = p_request_id
      and driver_id = auth.uid()
      and status in ('open', 'accepted');

  if not found then
    raise exception 'cannot_cancel';
  end if;
end;
$$;

revoke all on function public.request_dispatch(text, text, text) from public, anon;
revoke all on function public.accept_dispatch(uuid, integer) from public, anon;
revoke all on function public.cancel_dispatch(uuid) from public, anon;
grant execute on function public.request_dispatch(text, text, text) to authenticated;
grant execute on function public.accept_dispatch(uuid, integer) to authenticated;
grant execute on function public.cancel_dispatch(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Turn on Realtime for requests, so screens update without refreshing.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'dispatch_requests'
     ) then
    alter publication supabase_realtime add table public.dispatch_requests;
  end if;
end;
$$;
