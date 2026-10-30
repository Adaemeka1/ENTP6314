-- NemaGo payments (Stripe Connect). PRD F5a to F5e.
-- Run this AFTER schema.sql, drivers-and-mechanics.sql and dispatch.sql:
-- SQL Editor -> New query -> paste -> Run. Safe to run more than once.
--
-- The big ideas:
--   * A request starts as 'awaiting_payment'. Mechanics cannot see it.
--   * Only the server, after Stripe confirms payment, moves it to 'open'.
--   * Money steps (paid, completed, cancelled-with-refund, payout) are done by
--     the "admin_" functions below. Only the server's secret key can run them,
--     never a driver or mechanic from their browser.
--   * Stripe IDs live in a private table that nobody can read from the browser.

-- ---------------------------------------------------------------------
-- 1. New request states and money columns
-- ---------------------------------------------------------------------
alter table public.dispatch_requests
  drop constraint if exists dispatch_requests_status_check;
alter table public.dispatch_requests
  add constraint dispatch_requests_status_check
  check (status in ('awaiting_payment', 'open', 'accepted', 'completed', 'cancelled'));

alter table public.dispatch_requests alter column status set default 'awaiting_payment';

-- Amounts are in cents, set by the server only. The driver never supplies them.
alter table public.dispatch_requests
  add column if not exists price_cents integer
    check (price_cents is null or price_cents between 50 and 10000000),
  add column if not exists platform_fee_cents integer
    check (platform_fee_cents is null or platform_fee_cents >= 0),
  -- When the payment went through and mechanics could first see the request.
  add column if not exists opened_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists payout_status text not null default 'none'
    check (payout_status in ('none', 'pending', 'paid_out', 'failed')),
  add column if not exists refund_status text not null default 'none'
    check (refund_status in ('none', 'pending', 'refunded', 'failed'));

-- A driver can only have one request in progress, including one still waiting
-- for payment.
drop index if exists public.one_active_request_per_driver;
create unique index one_active_request_per_driver
  on public.dispatch_requests (driver_id)
  where status in ('awaiting_payment', 'open', 'accepted');

-- ---------------------------------------------------------------------
-- 2. Mechanics: their Stripe payout account
-- ---------------------------------------------------------------------
alter table public.mechanics
  add column if not exists stripe_account_id text,
  add column if not exists payouts_enabled boolean not null default false;
-- Mechanics cannot edit these two columns: the update permission in
-- drivers-and-mechanics.sql only lists the other columns.

-- ---------------------------------------------------------------------
-- 3. Private payment records. No policies and no grants for users, so
--    nothing here can be read or changed from a browser.
-- ---------------------------------------------------------------------
create table if not exists public.dispatch_payments (
  checkout_session_id text primary key,
  request_id uuid not null references public.dispatch_requests (id) on delete cascade,
  payment_intent_id text,
  paid_at timestamptz,
  refund_id text,
  transfer_id text,
  created_at timestamptz not null default now()
);

-- "used" marks the one payment that actually opened the request. Any other
-- payment (wrong amount, duplicate, late) is refunded and never used for payouts.
alter table public.dispatch_payments
  add column if not exists used boolean not null default false;

create index if not exists dispatch_payments_request_idx
  on public.dispatch_payments (request_id);

alter table public.dispatch_payments enable row level security;
revoke all on public.dispatch_payments from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Driver actions that change
-- ---------------------------------------------------------------------

-- Creating a request now creates it 'awaiting_payment'.
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
    where driver_id = auth.uid() and status in ('awaiting_payment', 'open', 'accepted')
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

-- Cancelling now goes through the server so a paid request is always refunded
-- (see admin_begin_cancel). The old browser-callable version is removed.
drop function if exists public.cancel_dispatch(uuid);

-- ---------------------------------------------------------------------
-- 5. Mechanic action that changes: no payout account, no jobs
-- ---------------------------------------------------------------------
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

  if not exists (
    select 1 from public.mechanics where id = auth.uid() and payouts_enabled
  ) then
    raise exception 'payouts_not_set_up';
  end if;

  select split_part(coalesce(full_name, ''), ' ', 1) into v_name
    from public.profiles where id = auth.uid();

  -- "where status = 'open'" keeps it first come, first served.
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

revoke all on function public.accept_dispatch(uuid, integer) from public, anon;
grant execute on function public.accept_dispatch(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Server-only "admin" functions. Only the server's secret key
--    (the service_role) may run these.
-- ---------------------------------------------------------------------

-- Remember a new Stripe Checkout Session for an unpaid request, and lock in
-- the price the server chose.
create or replace function public.admin_set_checkout(
  p_request_id uuid, p_driver_id uuid, p_session_id text, p_price_cents integer, p_fee_cents integer
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.dispatch_requests
    set price_cents = p_price_cents, platform_fee_cents = p_fee_cents
    where id = p_request_id and driver_id = p_driver_id and status = 'awaiting_payment';
  if not found then
    raise exception 'not_awaiting_payment';
  end if;

  insert into public.dispatch_payments (checkout_session_id, request_id)
    values (p_session_id, p_request_id);
end;
$$;

-- Stripe says a checkout was paid. Returns what the server should do next:
--   opened            the request is now visible to mechanics
--   already_processed this exact payment was already recorded (a retry)
--   needs_refund      the money should go back (cancelled request, duplicate
--                     payment, or an amount that doesn't match)
--   unknown_session   we have no record of this checkout (also refund)
create or replace function public.admin_mark_paid(
  p_session_id text, p_payment_intent_id text, p_amount_cents integer
)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.dispatch_payments;
  v_req public.dispatch_requests;
begin
  select * into v_pay from public.dispatch_payments
    where checkout_session_id = p_session_id for update;
  if not found then
    return 'unknown_session';
  end if;

  if v_pay.paid_at is not null then
    return 'already_processed';
  end if;

  select * into v_req from public.dispatch_requests
    where id = v_pay.request_id for update;

  -- Always record that this session was paid, so a refund can be matched to it.
  update public.dispatch_payments
    set paid_at = now(), payment_intent_id = p_payment_intent_id
    where checkout_session_id = p_session_id;

  if v_req.status <> 'awaiting_payment' or v_req.price_cents is distinct from p_amount_cents then
    return 'needs_refund';
  end if;

  update public.dispatch_requests set status = 'open', opened_at = now() where id = v_req.id;
  update public.dispatch_payments set used = true where checkout_session_id = p_session_id;
  return 'opened';
end;
$$;

-- Record that a refund was issued for a payment we couldn't use.
create or replace function public.admin_record_refund(p_session_id text, p_refund_id text)
returns void
language sql
security definer set search_path = ''
as $$
  update public.dispatch_payments set refund_id = p_refund_id
    where checkout_session_id = p_session_id;
$$;

-- A checkout expired unpaid: cancel the request if it is still waiting.
create or replace function public.admin_expire_checkout(p_session_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  select request_id into v_request_id from public.dispatch_payments
    where checkout_session_id = p_session_id;
  if not found then
    return;
  end if;

  -- Only cancel if no other checkout for this request was paid.
  if not exists (
    select 1 from public.dispatch_payments
    where request_id = v_request_id and paid_at is not null
  ) then
    update public.dispatch_requests
      set status = 'cancelled', problem = null
      where id = v_request_id and status = 'awaiting_payment';
  end if;
end;
$$;

-- A driver cancels. Unpaid: just cancel. Paid: cancel and flag a refund.
-- Safe to call again to retry a refund that failed.
create or replace function public.admin_begin_cancel(p_request_id uuid, p_driver_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_pay public.dispatch_payments;
  v_sessions jsonb;
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

  if v_req.status in ('open', 'accepted')
     or (v_req.status = 'cancelled' and v_req.refund_status in ('pending', 'failed')) then
    -- The paid checkout that has not been refunded yet.
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
      'session_id', v_pay.checkout_session_id,
      'payment_intent_id', v_pay.payment_intent_id
    );
  end if;

  raise exception 'cannot_cancel';
end;
$$;

create or replace function public.admin_finish_refund(
  p_request_id uuid, p_session_id text, p_refund_id text, p_ok boolean
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_ok then
    update public.dispatch_payments set refund_id = p_refund_id
      where checkout_session_id = p_session_id;
    update public.dispatch_requests set refund_status = 'refunded' where id = p_request_id;
  else
    update public.dispatch_requests set refund_status = 'failed' where id = p_request_id;
  end if;
end;
$$;

-- The accepting mechanic marks the job complete. Returns what the server needs
-- to pay them. Safe to call again to retry a payout that failed.
create or replace function public.admin_begin_completion(p_request_id uuid, p_mechanic_id uuid)
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
    raise exception 'cannot_complete';
  end if;

  if not (
    v_req.status = 'accepted'
    or (v_req.status = 'completed' and v_req.payout_status in ('pending', 'failed'))
  ) then
    raise exception 'cannot_complete';
  end if;

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

  update public.dispatch_requests
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        payout_status = 'pending'
    where id = p_request_id;

  return jsonb_build_object(
    'price_cents', v_req.price_cents,
    'platform_fee_cents', v_req.platform_fee_cents,
    'payment_intent_id', v_pay.payment_intent_id,
    'session_id', v_pay.checkout_session_id,
    'stripe_account_id', v_acct
  );
end;
$$;

create or replace function public.admin_finish_payout(
  p_request_id uuid, p_session_id text, p_transfer_id text, p_ok boolean
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_ok then
    update public.dispatch_payments set transfer_id = p_transfer_id
      where checkout_session_id = p_session_id;
    update public.dispatch_requests set payout_status = 'paid_out' where id = p_request_id;
  else
    update public.dispatch_requests set payout_status = 'failed' where id = p_request_id;
  end if;
end;
$$;

-- Save what Stripe says about a mechanic's payout account.
create or replace function public.admin_set_connect_account(
  p_mechanic_id uuid, p_account_id text, p_payouts_enabled boolean
)
returns void
language sql
security definer set search_path = ''
as $$
  update public.mechanics
    set stripe_account_id = p_account_id, payouts_enabled = p_payouts_enabled
    where id = p_mechanic_id;
$$;

-- ---------------------------------------------------------------------
-- 7. Lock the admin functions to the server's secret key
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_set_checkout(uuid, uuid, text, integer, integer)',
    'admin_mark_paid(text, text, integer)',
    'admin_record_refund(text, text)',
    'admin_expire_checkout(text)',
    'admin_begin_cancel(uuid, uuid)',
    'admin_finish_refund(uuid, text, text, boolean)',
    'admin_begin_completion(uuid, uuid)',
    'admin_finish_payout(uuid, text, text, boolean)',
    'admin_set_connect_account(uuid, text, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
