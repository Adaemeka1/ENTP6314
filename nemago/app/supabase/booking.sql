-- NemaGo two-path booking, vehicle-tier pricing, parts sourcing and the 90/10 payout split.
-- Run this AFTER schema.sql, drivers-and-mechanics.sql, dispatch.sql, payments.sql
-- and pricing-diagnostic.sql. Safe to run more than once.
--
-- RUN THIS BEFORE DEPLOYING THE MATCHING APP VERSION: the new screens read the
-- columns and tables created here.
--
-- What it adds, in plain words:
--   * Two booking types: 'diagnosis' (Something Is Wrong) and 'fixed_price'
--     (I Know What I Need), with the vehicle and the chosen service.
--   * job_transactions: every job is split into three buckets:
--       dispatch_fee           100% NemaGo  ($35)
--       parts_total            100% NemaGo  (wholesale cost + NemaGo's parts margin)
--       labor_and_diag_total   90% to the mechanic, 10% NemaGo
--     The 90/10 split is calculated HERE, in the database, from mechanic_percent().
--   * An 'arrived' step. The mechanic taps "I've arrived":
--       - Diagnosis jobs: the mechanic is paid their 90% of the diagnosis fee now.
--       - From arrival on, the customer is no longer refunded.
--       - Before arrival (until the mechanic is on site) a cancel is a full refund.
--   * parts_orders: the NemaGo-paid parts order a mechanic picks up, filled in by
--     NemaGo staff (store and order number).
-- Prices and amounts are set only by the server. Nothing here lets a customer
-- or a mechanic change a price, a split or a payout.

-- ---------------------------------------------------------------------
-- 1. New request columns, the 'arrived' status, one-active-request rule
-- ---------------------------------------------------------------------
alter table public.dispatch_requests
  drop constraint if exists dispatch_requests_status_check;
alter table public.dispatch_requests
  add constraint dispatch_requests_status_check
  check (status in ('awaiting_payment', 'open', 'accepted', 'arrived', 'diagnosed', 'completed', 'cancelled'));

alter table public.dispatch_requests
  add column if not exists booking_type text not null default 'diagnosis'
    check (booking_type in ('diagnosis', 'fixed_price')),
  add column if not exists service_id text
    check (service_id is null or service_id ~ '^[a-z0-9_]{3,40}$'),
  add column if not exists vehicle_year integer
    check (vehicle_year is null or vehicle_year between 1980 and 2100),
  add column if not exists vehicle_make text
    check (vehicle_make is null or char_length(btrim(vehicle_make)) between 1 and 40),
  add column if not exists vehicle_model text
    check (vehicle_model is null or char_length(btrim(vehicle_model)) between 1 and 60),
  -- Set by the server when it prices the job (never by the customer).
  add column if not exists vehicle_tier smallint
    check (vehicle_tier is null or vehicle_tier between 1 and 3),
  add column if not exists arrived_at timestamptz;

drop index if exists public.one_active_request_per_driver;
create unique index one_active_request_per_driver
  on public.dispatch_requests (driver_id)
  where status in ('awaiting_payment', 'open', 'accepted', 'arrived', 'diagnosed');

-- VIN and plate sit with the street address: only the customer and the mechanic
-- who accepted can read them.
alter table public.dispatch_contacts
  add column if not exists vehicle_vin text
    check (vehicle_vin is null or vehicle_vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  add column if not exists vehicle_plate text
    check (vehicle_plate is null or (char_length(vehicle_plate) between 2 and 10
           and vehicle_plate ~ '^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$'));

-- ---------------------------------------------------------------------
-- 2. The mechanic's share of the labor / diagnosis bucket
-- ---------------------------------------------------------------------
create or replace function public.mechanic_percent()
returns integer
language sql
immutable
as $$ select 90 $$;

-- ---------------------------------------------------------------------
-- 3. job_transactions: the three buckets, one row per job
-- ---------------------------------------------------------------------
create table if not exists public.job_transactions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.dispatch_requests (id) on delete cascade,
  booking_type text not null check (booking_type in ('diagnosis', 'fixed_price')),
  dispatch_fee_cents integer not null check (dispatch_fee_cents >= 0),
  parts_total_cents integer not null check (parts_total_cents >= 0),
  labor_and_diag_total_cents integer not null check (labor_and_diag_total_cents >= 0),
  -- How the labor / diagnosis bucket is shared (calculated by the database).
  mechanic_payout_cents integer not null check (mechanic_payout_cents >= 0),
  nemago_labor_cut_cents integer not null check (nemago_labor_cut_cents >= 0),
  total_cents integer generated always as
    (dispatch_fee_cents + parts_total_cents + labor_and_diag_total_cents) stored,
  created_at timestamptz not null default now(),
  check (mechanic_payout_cents + nemago_labor_cut_cents = labor_and_diag_total_cents)
);

alter table public.job_transactions enable row level security;
revoke all on public.job_transactions from anon, authenticated;
grant select on public.job_transactions to authenticated;

drop policy if exists "Drivers read own job transactions" on public.job_transactions;
create policy "Drivers read own job transactions"
  on public.job_transactions for select
  using (exists (
    select 1 from public.dispatch_requests r
    where r.id = request_id and r.driver_id = auth.uid()
  ));

drop policy if exists "Assigned mechanics read their job transactions" on public.job_transactions;
create policy "Assigned mechanics read their job transactions"
  on public.job_transactions for select
  using (public.is_verified_mechanic() and exists (
    select 1 from public.dispatch_requests r
    where r.id = request_id and r.mechanic_id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- 4. parts_orders: what the mechanic picks up (pre-paid by NemaGo)
-- ---------------------------------------------------------------------
create table if not exists public.parts_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.dispatch_requests (id) on delete cascade,
  status text not null default 'preparing'
    check (status in ('preparing', 'ready', 'picked_up', 'cancelled')),
  -- Filled in by NemaGo staff in the Supabase Table Editor once the order is placed.
  store_name text,
  store_address text,
  order_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A "ready" order must say where to go and which order to ask for.
  check (status in ('preparing', 'cancelled')
         or (store_name is not null and store_address is not null and order_number is not null))
);

alter table public.parts_orders enable row level security;
revoke all on public.parts_orders from anon, authenticated;
grant select on public.parts_orders to authenticated;

drop policy if exists "Assigned mechanics read their parts order" on public.parts_orders;
create policy "Assigned mechanics read their parts order"
  on public.parts_orders for select
  using (public.is_verified_mechanic() and exists (
    select 1 from public.dispatch_requests r
    where r.id = request_id and r.mechanic_id = auth.uid()
  ));

create or replace function public.parts_orders_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists parts_orders_touch on public.parts_orders;
create trigger parts_orders_touch
  before update on public.parts_orders
  for each row execute function public.parts_orders_touch();

-- When a fixed-price job is paid, start a parts order. When a job is cancelled,
-- cancel its parts order.
create or replace function public.booking_after_status_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.status = 'open' and old.status = 'awaiting_payment' and new.booking_type = 'fixed_price' then
    if exists (
      select 1 from public.job_transactions t
      where t.request_id = new.id and t.parts_total_cents > 0
    ) then
      insert into public.parts_orders (request_id) values (new.id)
        on conflict (request_id) do nothing;
    end if;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.parts_orders set status = 'cancelled'
      where request_id = new.id and status in ('preparing', 'ready');
  end if;
  return new;
end;
$$;

drop trigger if exists booking_after_status_change on public.dispatch_requests;
create trigger booking_after_status_change
  after update of status on public.dispatch_requests
  for each row when (old.status is distinct from new.status)
  execute function public.booking_after_status_change();

-- ---------------------------------------------------------------------
-- 5. Customer action: create a booking (price is NOT set here)
-- ---------------------------------------------------------------------
create or replace function public.request_booking(
  p_booking_type text,
  p_service_id text,
  p_problem text,
  p_area text,
  p_address text,
  p_year integer,
  p_make text,
  p_model text,
  p_vin text,
  p_plate text
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
  v_vin text := nullif(upper(btrim(coalesce(p_vin, ''))), '');
  v_plate text := nullif(upper(btrim(coalesce(p_plate, ''))), '');
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

  if p_booking_type not in ('diagnosis', 'fixed_price') then
    raise exception 'invalid_booking';
  end if;
  if p_booking_type = 'fixed_price' and p_service_id is null then
    raise exception 'invalid_booking';
  end if;
  if v_vin is null and v_plate is null then
    raise exception 'vehicle_id_required';
  end if;
  if p_booking_type = 'diagnosis' and v_vin is null then
    raise exception 'vin_required';
  end if;

  if exists (
    select 1 from public.dispatch_requests
    where driver_id = auth.uid()
      and status in ('awaiting_payment', 'open', 'accepted', 'arrived', 'diagnosed')
  ) then
    raise exception 'already_active';
  end if;

  insert into public.dispatch_requests
    (driver_id, problem, area, booking_type, service_id, vehicle_year, vehicle_make, vehicle_model)
  values
    (auth.uid(), btrim(p_problem), btrim(p_area), p_booking_type,
     case when p_booking_type = 'fixed_price' then p_service_id end,
     p_year, btrim(p_make), btrim(p_model))
  returning id into v_id;

  insert into public.dispatch_contacts (request_id, driver_first_name, address, vehicle_vin, vehicle_plate)
    values (v_id, nullif(v_name, ''), btrim(p_address), v_vin, v_plate);

  return v_id;
end;
$$;

revoke all on function public.request_booking(text, text, text, text, text, integer, text, text, text, text) from public, anon;
grant execute on function public.request_booking(text, text, text, text, text, integer, text, text, text, text) to authenticated;

-- The older request function must also count 'arrived' as "in progress".
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
    where driver_id = auth.uid()
      and status in ('awaiting_payment', 'open', 'accepted', 'arrived', 'diagnosed')
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

revoke all on function public.request_dispatch(text, text, text) from public, anon;
grant execute on function public.request_dispatch(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Mechanic action: the diagnosis note, now written after arriving
-- ---------------------------------------------------------------------
create or replace function public.record_diagnosis(p_request_id uuid, p_diagnosis text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_verified_mechanic() then
    raise exception 'not_verified';
  end if;

  update public.dispatch_requests
    set status = 'diagnosed',
        diagnosis = trim(p_diagnosis),
        diagnosed_at = now()
    where id = p_request_id
      and mechanic_id = auth.uid()
      and booking_type = 'diagnosis'
      and status = 'arrived';

  if not found then
    raise exception 'cannot_diagnose';
  end if;
end;
$$;

revoke all on function public.record_diagnosis(uuid, text) from public, anon;
grant execute on function public.record_diagnosis(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Server-only money functions (only the server's secret key can run these)
-- ---------------------------------------------------------------------

-- A small helper that packages what the server needs to pay a mechanic.
create or replace function public.payout_json(
  p_price_cents integer, p_fee_cents integer, p_payment_intent_id text, p_session_id text, p_account text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'price_cents', p_price_cents,
    'platform_fee_cents', p_fee_cents,
    'payment_intent_id', p_payment_intent_id,
    'session_id', p_session_id,
    'stripe_account_id', p_account
  );
$$;

-- The server has priced a booking and made a Stripe checkout. Records the three
-- buckets, sets the price, and works out the 90/10 split. NemaGo keeps everything
-- that is not the mechanic's share, so platform_fee = price - mechanic payout.
create or replace function public.admin_set_checkout_v2(
  p_request_id uuid,
  p_driver_id uuid,
  p_session_id text,
  p_dispatch_fee_cents integer,
  p_parts_total_cents integer,
  p_labor_and_diag_cents integer,
  p_tier integer
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_type text;
  v_total integer;
  v_mechanic integer;
begin
  v_total := p_dispatch_fee_cents + p_parts_total_cents + p_labor_and_diag_cents;
  if v_total < 50 or p_labor_and_diag_cents < 0 or p_parts_total_cents < 0 or p_dispatch_fee_cents < 0 then
    raise exception 'invalid_amounts';
  end if;
  v_mechanic := floor((p_labor_and_diag_cents * public.mechanic_percent() + 50) / 100.0)::integer;

  update public.dispatch_requests
    set price_cents = v_total,
        platform_fee_cents = v_total - v_mechanic,
        vehicle_tier = p_tier
    where id = p_request_id and driver_id = p_driver_id and status = 'awaiting_payment'
    returning booking_type into v_type;
  if not found then
    raise exception 'not_awaiting_payment';
  end if;

  insert into public.job_transactions
    (request_id, booking_type, dispatch_fee_cents, parts_total_cents, labor_and_diag_total_cents,
     mechanic_payout_cents, nemago_labor_cut_cents)
  values
    (p_request_id, v_type, p_dispatch_fee_cents, p_parts_total_cents, p_labor_and_diag_cents,
     v_mechanic, p_labor_and_diag_cents - v_mechanic)
  on conflict (request_id) do update
    set dispatch_fee_cents = excluded.dispatch_fee_cents,
        parts_total_cents = excluded.parts_total_cents,
        labor_and_diag_total_cents = excluded.labor_and_diag_total_cents,
        mechanic_payout_cents = excluded.mechanic_payout_cents,
        nemago_labor_cut_cents = excluded.nemago_labor_cut_cents;

  insert into public.dispatch_payments (checkout_session_id, request_id)
    values (p_session_id, p_request_id);
end;
$$;

-- The mechanic taps "I've arrived".
--   Diagnosis job: they are paid their 90% of the diagnosis fee now.
--   Fixed-price job: nothing is paid yet (labor is paid on completion).
-- Safe to call again to retry a diagnosis payout that failed.
create or replace function public.admin_begin_arrival(p_request_id uuid, p_mechanic_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_pay public.dispatch_payments;
  v_acct text;
begin
  select * into v_req from public.dispatch_requests
    where id = p_request_id and mechanic_id = p_mechanic_id for update;
  if not found then
    raise exception 'cannot_arrive';
  end if;

  if not (
    v_req.status = 'accepted'
    or (v_req.status = 'arrived' and v_req.booking_type = 'diagnosis'
        and v_req.payout_status in ('pending', 'failed'))
  ) then
    raise exception 'cannot_arrive';
  end if;

  if v_req.status = 'accepted' then
    update public.dispatch_requests
      set status = 'arrived', arrived_at = now()
      where id = p_request_id;
  end if;

  if v_req.booking_type = 'diagnosis' and v_req.payout_status <> 'paid_out' then
    select * into v_pay from public.dispatch_payments
      where request_id = p_request_id and used and refund_id is null;
    if not found or v_req.price_cents is null or v_req.platform_fee_cents is null then
      raise exception 'not_paid';
    end if;
    select stripe_account_id into v_acct from public.mechanics
      where id = p_mechanic_id and payouts_enabled;
    if v_acct is null then
      raise exception 'payouts_not_set_up';
    end if;

    update public.dispatch_requests set payout_status = 'pending' where id = p_request_id;
    return jsonb_build_object('payout', public.payout_json(
      v_req.price_cents, v_req.platform_fee_cents, v_pay.payment_intent_id, v_pay.checkout_session_id, v_acct));
  end if;

  return jsonb_build_object('payout', null);
end;
$$;

-- The customer cancels.
--   unpaid                          -> just cancel
--   paid, mechanic not here yet     -> cancel and refund everything
--   mechanic has arrived            -> cancel, NO refund; the mechanic is paid
--                                      (if they have not been already)
-- Safe to call again to retry a failed refund or a failed payout.
create or replace function public.admin_begin_cancel(p_request_id uuid, p_driver_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_pay public.dispatch_payments;
  v_sessions jsonb;
  v_acct text;
  v_payout jsonb := null;
begin
  select * into v_req from public.dispatch_requests
    where id = p_request_id and driver_id = p_driver_id for update;
  if not found then
    raise exception 'cannot_cancel';
  end if;

  if v_req.status = 'awaiting_payment' then
    update public.dispatch_requests
      set status = 'cancelled', problem = null where id = p_request_id;
    select coalesce(jsonb_agg(checkout_session_id), '[]'::jsonb) into v_sessions
      from public.dispatch_payments
      where request_id = p_request_id and paid_at is null;
    return jsonb_build_object('was_paid', false, 'unpaid_sessions', v_sessions);
  end if;

  -- The mechanic is on site (or a payout from a cancelled on-site job needs a retry).
  if v_req.status in ('arrived', 'diagnosed')
     or (v_req.status = 'cancelled' and v_req.refund_status = 'none'
         and v_req.payout_status in ('pending', 'failed')
         and (v_req.arrived_at is not null or v_req.diagnosis is not null)) then
    select * into v_pay from public.dispatch_payments
      where request_id = p_request_id and used and refund_id is null;
    if not found or v_req.price_cents is null or v_req.platform_fee_cents is null then
      raise exception 'not_paid';
    end if;

    if v_req.payout_status <> 'paid_out' then
      select stripe_account_id into v_acct from public.mechanics
        where id = v_req.mechanic_id and stripe_account_id is not null;
      if v_acct is null then
        raise exception 'payouts_not_set_up';
      end if;
      v_payout := public.payout_json(
        v_req.price_cents, v_req.platform_fee_cents, v_pay.payment_intent_id, v_pay.checkout_session_id, v_acct);
    end if;

    update public.dispatch_requests
      set status = 'cancelled',
          problem = null,
          payout_status = case when v_req.payout_status = 'paid_out' then 'paid_out' else 'pending' end
      where id = p_request_id;

    return jsonb_build_object('was_paid', true, 'refund', false, 'payout', v_payout);
  end if;

  -- Before the mechanic arrives: full refund.
  if v_req.status in ('open', 'accepted')
     or (v_req.status = 'cancelled' and v_req.refund_status in ('pending', 'failed')) then
    select * into v_pay from public.dispatch_payments
      where request_id = p_request_id and used and refund_id is null;
    if not found then
      raise exception 'cannot_cancel';
    end if;

    update public.dispatch_requests
      set status = 'cancelled', problem = null, refund_status = 'pending'
      where id = p_request_id;
    return jsonb_build_object(
      'was_paid', true,
      'refund', true,
      'session_id', v_pay.checkout_session_id,
      'payment_intent_id', v_pay.payment_intent_id
    );
  end if;

  raise exception 'cannot_cancel';
end;
$$;

-- The mechanic marks the job complete.
--   Diagnosis job:    after the diagnosis note. (They were already paid on arrival,
--                     so this only pays if that payout still needs a retry.)
--   Fixed-price job:  after arriving. This pays their 90% of the labor.
-- Safe to call again to retry a failed payout.
create or replace function public.admin_begin_completion(p_request_id uuid, p_mechanic_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_pay public.dispatch_payments;
  v_acct text;
  v_payout jsonb := null;
begin
  select * into v_req from public.dispatch_requests
    where id = p_request_id and mechanic_id = p_mechanic_id for update;
  if not found then
    raise exception 'cannot_complete';
  end if;

  if not (
    (v_req.booking_type = 'diagnosis' and v_req.status = 'diagnosed')
    or (v_req.booking_type = 'fixed_price' and v_req.status = 'arrived')
    or (v_req.status in ('completed', 'cancelled') and v_req.payout_status in ('pending', 'failed'))
  ) then
    raise exception 'cannot_complete';
  end if;

  select * into v_pay from public.dispatch_payments
    where request_id = p_request_id and used and refund_id is null;
  if not found or v_req.price_cents is null or v_req.platform_fee_cents is null then
    raise exception 'not_paid';
  end if;

  if v_req.payout_status <> 'paid_out' then
    select stripe_account_id into v_acct from public.mechanics
      where id = p_mechanic_id and payouts_enabled;
    if v_acct is null then
      raise exception 'payouts_not_set_up';
    end if;
    v_payout := public.payout_json(
      v_req.price_cents, v_req.platform_fee_cents, v_pay.payment_intent_id, v_pay.checkout_session_id, v_acct);
  end if;

  if v_req.status in ('diagnosed', 'arrived') then
    update public.dispatch_requests
      set status = 'completed',
          completed_at = now(),
          payout_status = case when v_req.payout_status = 'paid_out' then 'paid_out' else 'pending' end
      where id = p_request_id;
  else
    update public.dispatch_requests
      set payout_status = case when v_req.payout_status = 'paid_out' then 'paid_out' else 'pending' end
      where id = p_request_id;
  end if;

  return jsonb_build_object('payout', v_payout);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Lock the server-only functions to the server's secret key
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_set_checkout_v2(uuid, uuid, text, integer, integer, integer, integer)',
    'admin_begin_arrival(uuid, uuid)',
    'admin_begin_cancel(uuid, uuid)',
    'admin_begin_completion(uuid, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
