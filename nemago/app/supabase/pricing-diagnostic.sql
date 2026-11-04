-- NemaGo pricing engine: $115.00 = $35.00 dispatch fee + $80.00 diagnostic fee,
-- with a "diagnostic entry" step. PRD F5d, F5e and F5f.
-- Run this AFTER payments.sql. Safe to run more than once.
--
-- The rules, in plain words:
--   * After accepting, the mechanic records a diagnosis. The request becomes
--     'diagnosed'.
--   * Cancelled BEFORE a diagnosis: the driver gets all $115.00 back.
--   * Once a diagnosis exists the money is not refunded. Whether the mechanic
--     marks the job complete OR the driver cancels, NemaGo keeps the $35.00 and
--     the mechanic is paid the $80.00.
--   * A job can only be marked complete after a diagnosis was recorded.
--   * The dollar amounts themselves are set by the server (lib/fees.ts), never
--     by anyone's browser.

-- ---------------------------------------------------------------------
-- 1. New state and diagnosis columns
-- ---------------------------------------------------------------------
alter table public.dispatch_requests
  drop constraint if exists dispatch_requests_status_check;
alter table public.dispatch_requests
  add constraint dispatch_requests_status_check
  check (status in ('awaiting_payment', 'open', 'accepted', 'diagnosed', 'completed', 'cancelled'));

alter table public.dispatch_requests
  add column if not exists diagnosis text
    check (diagnosis is null or char_length(diagnosis) between 3 and 1000),
  add column if not exists diagnosed_at timestamptz;

-- A driver still only has one request in progress, now including 'diagnosed'.
drop index if exists public.one_active_request_per_driver;
create unique index one_active_request_per_driver
  on public.dispatch_requests (driver_id)
  where status in ('awaiting_payment', 'open', 'accepted', 'diagnosed');

-- Same check, now counting 'diagnosed' as in progress.
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
      and status in ('awaiting_payment', 'open', 'accepted', 'diagnosed')
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
-- 2. Diagnostic entry: the assigned mechanic records what they found
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
      and status = 'accepted';

  if not found then
    raise exception 'cannot_diagnose';
  end if;
end;
$$;

revoke all on function public.record_diagnosis(uuid, text) from public, anon;
grant execute on function public.record_diagnosis(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Server-only money rules (only the server's secret key can run these)
-- ---------------------------------------------------------------------

-- The driver cancels.
--   unpaid                    -> just cancel
--   paid, no diagnosis yet    -> cancel and refund everything
--   diagnosis recorded        -> cancel, NO refund, pay the mechanic their $80
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

  -- After diagnostic entry: no refund. The mechanic keeps the diagnostic fee.
  if v_req.status = 'diagnosed'
     or (v_req.status = 'cancelled' and v_req.payout_status in ('pending', 'failed')) then
    select * into v_pay from public.dispatch_payments
      where request_id = p_request_id and used and refund_id is null;
    if not found or v_req.price_cents is null or v_req.platform_fee_cents is null then
      raise exception 'not_paid';
    end if;

    select stripe_account_id into v_acct from public.mechanics
      where id = v_req.mechanic_id and stripe_account_id is not null;
    if v_acct is null then
      raise exception 'payouts_not_set_up';
    end if;

    update public.dispatch_requests
      set status = 'cancelled', problem = null, payout_status = 'pending'
      where id = p_request_id;

    return jsonb_build_object(
      'was_paid', true,
      'refund', false,
      'payout', jsonb_build_object(
        'price_cents', v_req.price_cents,
        'platform_fee_cents', v_req.platform_fee_cents,
        'payment_intent_id', v_pay.payment_intent_id,
        'session_id', v_pay.checkout_session_id,
        'stripe_account_id', v_acct
      )
    );
  end if;

  -- Before diagnostic entry: full refund.
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

-- The mechanic marks the job complete. Only allowed after a diagnosis was
-- recorded. Safe to call again to retry a failed payout (also for a job the
-- driver cancelled after the diagnosis).
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
    v_req.status = 'diagnosed'
    or (v_req.status in ('completed', 'cancelled') and v_req.payout_status in ('pending', 'failed'))
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

  if v_req.status = 'diagnosed' then
    update public.dispatch_requests
      set status = 'completed', completed_at = now(), payout_status = 'pending'
      where id = p_request_id;
  else
    update public.dispatch_requests
      set payout_status = 'pending' where id = p_request_id;
  end if;

  return jsonb_build_object(
    'price_cents', v_req.price_cents,
    'platform_fee_cents', v_req.platform_fee_cents,
    'payment_intent_id', v_pay.payment_intent_id,
    'session_id', v_pay.checkout_session_id,
    'stripe_account_id', v_acct
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Permissions: server-only functions stay server-only
-- ---------------------------------------------------------------------
revoke all on function public.admin_begin_cancel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_begin_cancel(uuid, uuid) to service_role;
revoke all on function public.admin_begin_completion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_begin_completion(uuid, uuid) to service_role;
