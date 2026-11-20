-- NemaGo: Secondary Approval Gate (post-diagnosis repair quote and scheduling).
-- Run this once in the Supabase SQL Editor (it is safe to run again).
-- Run it AFTER booking.sql. Run it before deploying the repair quote screens.
--
-- How it works:
--   1. On a diagnosis job, after the mechanic records the diagnosis (status
--      'diagnosed') they send ONE repair quote: summary, description, photo,
--      parts total, labor total, and a proposed repair date and time window.
--   2. The driver sees the quote. Net balance due =
--          parts total + labor total - $80.00 diagnostic credit.
--      "Approve & Pay Balance" opens Stripe Checkout for that balance.
--      "Decline Repair" closes the job. The mechanic keeps the 90% of the $80
--      they were already paid when they arrived.
--   3. When the mechanic finishes the repair they mark it complete and are paid:
--          parts total            100% NemaGo
--          labor total - $80      90% mechanic / 10% NemaGo
--      (The first $80 of labor was already split 90/10 as the diagnosis fee.)

-- ---------------------------------------------------------------------
-- 1. Constants
-- ---------------------------------------------------------------------
create or replace function public.diagnostic_credit_cents()
returns integer
language sql
immutable
set search_path = ''
as $$ select 8000 $$;

-- ---------------------------------------------------------------------
-- 2. repair_quotes: one quote per job
-- ---------------------------------------------------------------------
create table if not exists public.repair_quotes (
  request_id uuid primary key references public.dispatch_requests (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  mechanic_id uuid not null references public.mechanics (id) on delete cascade,
  issue_summary text not null check (char_length(issue_summary) between 3 and 300),
  repair_description text not null check (char_length(repair_description) between 3 and 1000),
  -- A demo photo for now: real photo upload needs a consent and storage flow first.
  photo_id text not null
    check (photo_id in ('brake_pads', 'battery_terminal', 'coolant_leak', 'worn_belt', 'tire_damage')),
  -- The money buckets, in cents.
  parts_cents integer not null check (parts_cents between 0 and 500000),
  labor_cents integer not null check (labor_cents between 8000 and 500000),
  credit_cents integer not null check (credit_cents = 8000),
  net_due_cents integer not null check (net_due_cents >= 100),
  -- How the labor still to be collected (labor - credit) is shared.
  mechanic_payout_cents integer not null check (mechanic_payout_cents >= 0),
  nemago_labor_cut_cents integer not null check (nemago_labor_cut_cents >= 0),
  repair_date date not null,
  window_start time not null check (window_start in ('08:00', '10:00', '12:00', '14:00', '16:00')),
  window_end time not null,
  status text not null default 'sent'
    check (status in ('sent', 'paid', 'completed', 'declined', 'withdrawn')),
  payout_status text not null default 'none'
    check (payout_status in ('none', 'pending', 'paid_out', 'failed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,
  check (net_due_cents = parts_cents + labor_cents - credit_cents),
  check (mechanic_payout_cents + nemago_labor_cut_cents = labor_cents - credit_cents)
);

alter table public.repair_quotes enable row level security;
revoke all on public.repair_quotes from anon, authenticated;
grant select on public.repair_quotes to authenticated;
-- No insert, update or delete for users: quotes are changed by the functions below only.

drop policy if exists "Drivers read own repair quotes" on public.repair_quotes;
create policy "Drivers read own repair quotes"
  on public.repair_quotes for select
  using (driver_id = auth.uid());

drop policy if exists "Mechanics read their repair quotes" on public.repair_quotes;
create policy "Mechanics read their repair quotes"
  on public.repair_quotes for select
  using (public.is_verified_mechanic() and mechanic_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. repair_payments: private Stripe records (no policies, no grants)
-- ---------------------------------------------------------------------
create table if not exists public.repair_payments (
  checkout_session_id text primary key,
  request_id uuid not null references public.dispatch_requests (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  payment_intent_id text,
  paid_at timestamptz,
  used boolean not null default false,
  transfer_id text,
  refund_id text,
  created_at timestamptz not null default now()
);

create index if not exists repair_payments_request_idx on public.repair_payments (request_id);

alter table public.repair_payments enable row level security;
revoke all on public.repair_payments from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Mechanic: send the repair quote (once, after recording the diagnosis)
-- ---------------------------------------------------------------------
create or replace function public.submit_repair_quote(
  p_request_id uuid,
  p_issue_summary text,
  p_repair_description text,
  p_photo_id text,
  p_parts_cents integer,
  p_labor_cents integer,
  p_repair_date date,
  p_window_start text
)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_summary text := btrim(coalesce(p_issue_summary, ''));
  v_desc text := btrim(coalesce(p_repair_description, ''));
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_start time;
  v_credit integer := public.diagnostic_credit_cents();
  v_labor_net integer;
  v_mech integer;
begin
  if not public.is_verified_mechanic() then
    raise exception 'not_verified';
  end if;

  select * into v_req from public.dispatch_requests
    where id = p_request_id and mechanic_id = auth.uid() for update;
  if not found or v_req.booking_type <> 'diagnosis' or v_req.status <> 'diagnosed' then
    raise exception 'cannot_quote';
  end if;
  if exists (select 1 from public.repair_quotes where request_id = p_request_id) then
    raise exception 'quote_exists';
  end if;

  if char_length(v_summary) not between 3 and 300
     or char_length(v_desc) not between 3 and 1000
     or p_photo_id is null
     or p_parts_cents is null or p_parts_cents not between 0 and 500000
     or p_labor_cents is null or p_labor_cents not between v_credit and 500000
     or p_parts_cents + p_labor_cents - v_credit < 100
     or p_repair_date is null or p_repair_date not between v_today and v_today + 30
     or p_window_start is null or p_window_start not in ('08:00', '10:00', '12:00', '14:00', '16:00') then
    raise exception 'invalid_quote';
  end if;
  v_start := p_window_start::time;

  -- The first $80 of labor was already paid and split 90/10 as the diagnosis fee,
  -- so only labor above it is split now.
  v_labor_net := p_labor_cents - v_credit;
  v_mech := floor((v_labor_net * public.mechanic_percent() + 50) / 100.0);

  insert into public.repair_quotes (
    request_id, driver_id, mechanic_id, issue_summary, repair_description, photo_id,
    parts_cents, labor_cents, credit_cents, net_due_cents,
    mechanic_payout_cents, nemago_labor_cut_cents,
    repair_date, window_start, window_end
  ) values (
    p_request_id, v_req.driver_id, v_req.mechanic_id, v_summary, v_desc, p_photo_id,
    p_parts_cents, p_labor_cents, v_credit, p_parts_cents + v_labor_net,
    v_mech, v_labor_net - v_mech,
    p_repair_date, v_start, v_start + interval '2 hours'
  );

  return 'sent';
end;
$$;

revoke all on function public.submit_repair_quote(uuid, text, text, text, integer, integer, date, text) from public, anon;
grant execute on function public.submit_repair_quote(uuid, text, text, text, integer, integer, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Driver: decline the repair (closes the job; the diagnosis fee is not refunded)
-- ---------------------------------------------------------------------
create or replace function public.decline_repair_quote(p_request_id uuid)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
begin
  select * into v_req from public.dispatch_requests
    where id = p_request_id and driver_id = auth.uid() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_req.status <> 'diagnosed' then
    raise exception 'cannot_decline';
  end if;

  update public.repair_quotes set status = 'declined', decided_at = now()
    where request_id = p_request_id and status = 'sent';
  if not found then
    raise exception 'cannot_decline';
  end if;

  -- Closed cleanly. The mechanic keeps what they were paid on arrival (90% of the $80).
  update public.dispatch_requests set status = 'completed', completed_at = now()
    where id = p_request_id;
  return 'declined';
end;
$$;

revoke all on function public.decline_repair_quote(uuid) from public, anon;
grant execute on function public.decline_repair_quote(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Guard: a paid repair can't be cancelled or skipped; an open quote is withdrawn
--    when the job is closed another way.
-- ---------------------------------------------------------------------
create or replace function public.repair_guard_status()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.repair_quotes where request_id = new.id;
  if v_status = 'paid' then
    -- The driver paid for a repair that has not happened yet. Only the repair
    -- completion function (which first marks the quote 'completed') may close it.
    if new.status = 'cancelled' then
      raise exception 'cannot_cancel';
    end if;
    raise exception 'cannot_complete';
  elsif v_status = 'sent' then
    update public.repair_quotes set status = 'withdrawn', decided_at = now() where request_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists repair_guard_status on public.dispatch_requests;
create trigger repair_guard_status
  before update of status on public.dispatch_requests
  for each row
  when (old.status = 'diagnosed' and new.status in ('completed', 'cancelled'))
  execute function public.repair_guard_status();

-- ---------------------------------------------------------------------
-- 7. Server-only money functions
-- ---------------------------------------------------------------------

-- The driver wants to approve. Returns what to charge (never taken from the browser).
create or replace function public.admin_begin_repair_checkout(p_request_id uuid, p_driver_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_q public.repair_quotes;
begin
  select * into v_req from public.dispatch_requests
    where id = p_request_id and driver_id = p_driver_id for update;
  select * into v_q from public.repair_quotes where request_id = p_request_id for update;
  if v_req.id is null or v_q.request_id is null or v_req.status <> 'diagnosed' or v_q.status <> 'sent' then
    raise exception 'cannot_approve';
  end if;
  return jsonb_build_object(
    'parts_cents', v_q.parts_cents,
    'labor_net_cents', v_q.labor_cents - v_q.credit_cents,
    'net_due_cents', v_q.net_due_cents
  );
end;
$$;

-- The server made a Stripe Checkout for the balance. Remember it.
create or replace function public.admin_set_repair_checkout(
  p_request_id uuid, p_driver_id uuid, p_session_id text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_q public.repair_quotes;
begin
  select * into v_q from public.repair_quotes
    where request_id = p_request_id and driver_id = p_driver_id for update;
  if not found or v_q.status <> 'sent' then
    raise exception 'cannot_approve';
  end if;
  insert into public.repair_payments (checkout_session_id, request_id, amount_cents)
    values (p_session_id, p_request_id, v_q.net_due_cents)
    on conflict (checkout_session_id) do nothing;
end;
$$;

-- Stripe says a repair checkout was paid. Returns:
--   scheduled         the quote is now paid and the repair is scheduled
--   already_processed this exact payment was already recorded (a retry)
--   needs_refund      the money should go back (quote withdrawn or declined,
--                     a second payment, or a wrong amount)
--   unknown_session   we have no record of it (refund too)
create or replace function public.admin_mark_repair_paid(
  p_session_id text, p_payment_intent_id text, p_amount_cents integer
)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.repair_payments;
  v_req public.dispatch_requests;
  v_q public.repair_quotes;
begin
  select * into v_pay from public.repair_payments
    where checkout_session_id = p_session_id for update;
  if not found then
    return 'unknown_session';
  end if;
  if v_pay.paid_at is not null then
    return 'already_processed';
  end if;

  select * into v_req from public.dispatch_requests where id = v_pay.request_id for update;
  select * into v_q from public.repair_quotes where request_id = v_pay.request_id for update;

  update public.repair_payments
    set paid_at = now(), payment_intent_id = p_payment_intent_id
    where checkout_session_id = p_session_id;

  if v_req.status is distinct from 'diagnosed' or v_q.status is distinct from 'sent'
     or v_q.net_due_cents is distinct from p_amount_cents
     or v_pay.amount_cents is distinct from p_amount_cents then
    return 'needs_refund';
  end if;

  update public.repair_payments set used = true where checkout_session_id = p_session_id;
  update public.repair_quotes set status = 'paid', decided_at = now(), paid_at = now()
    where request_id = v_pay.request_id;

  -- NemaGo buys the parts, so the mechanic's "Parts Ready for Pickup" card gets an order.
  if v_q.parts_cents > 0 then
    insert into public.parts_orders (request_id) values (v_pay.request_id)
      on conflict (request_id) do nothing;
  end if;
  return 'scheduled';
end;
$$;

create or replace function public.admin_record_repair_refund(p_session_id text, p_refund_id text)
returns void
language sql
security definer set search_path = ''
as $$
  update public.repair_payments set refund_id = p_refund_id where checkout_session_id = p_session_id;
$$;

-- The mechanic finished the repair. Closes the job and returns what to pay them:
-- 90% of (labor - $80). Parts are 100% NemaGo's. Safe to call again to retry a
-- failed payout; it can never pay twice.
create or replace function public.admin_begin_repair_completion(p_request_id uuid, p_mechanic_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_q public.repair_quotes;
  v_pay public.repair_payments;
  v_acct text;
begin
  select * into v_req from public.dispatch_requests
    where id = p_request_id and mechanic_id = p_mechanic_id for update;
  select * into v_q from public.repair_quotes where request_id = p_request_id for update;
  if v_req.id is null or v_q.request_id is null then
    raise exception 'cannot_complete';
  end if;

  if not (
    (v_req.status = 'diagnosed' and v_q.status = 'paid')
    or (v_q.status = 'completed' and v_q.payout_status in ('pending', 'failed'))
  ) then
    raise exception 'cannot_complete';
  end if;

  select * into v_pay from public.repair_payments
    where request_id = p_request_id and used and refund_id is null;
  if not found then
    raise exception 'not_paid';
  end if;

  if v_q.mechanic_payout_cents = 0 then
    -- Nothing to transfer (labor was exactly the $80 credit).
    update public.repair_quotes set status = 'completed', payout_status = 'paid_out',
      completed_at = coalesce(completed_at, now()) where request_id = p_request_id;
    update public.dispatch_requests set status = 'completed', completed_at = coalesce(completed_at, now())
      where id = p_request_id and status = 'diagnosed';
    return jsonb_build_object('payout', null);
  end if;

  select stripe_account_id into v_acct from public.mechanics
    where id = p_mechanic_id and payouts_enabled;
  if v_acct is null then
    raise exception 'payouts_not_set_up';
  end if;

  if v_q.status = 'paid' then
    -- Mark the quote first: the guard on dispatch_requests lets the job close once it is 'completed'.
    update public.repair_quotes set status = 'completed', payout_status = 'pending', completed_at = now()
      where request_id = p_request_id;
    update public.dispatch_requests set status = 'completed', completed_at = now() where id = p_request_id;
  else
    update public.repair_quotes set payout_status = 'pending' where request_id = p_request_id;
  end if;

  return jsonb_build_object('payout', jsonb_build_object(
    'amount_cents', v_q.mechanic_payout_cents,
    'payment_intent_id', v_pay.payment_intent_id,
    'session_id', v_pay.checkout_session_id,
    'stripe_account_id', v_acct
  ));
end;
$$;

create or replace function public.admin_finish_repair_payout(
  p_request_id uuid, p_session_id text, p_transfer_id text, p_ok boolean
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_ok then
    update public.repair_payments set transfer_id = p_transfer_id where checkout_session_id = p_session_id;
    update public.repair_quotes set payout_status = 'paid_out' where request_id = p_request_id;
  else
    update public.repair_quotes set payout_status = 'failed' where request_id = p_request_id;
  end if;
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
    'admin_begin_repair_checkout(uuid, uuid)',
    'admin_set_repair_checkout(uuid, uuid, text)',
    'admin_mark_repair_paid(text, text, integer)',
    'admin_record_repair_refund(text, text)',
    'admin_begin_repair_completion(uuid, uuid)',
    'admin_finish_repair_payout(uuid, text, text, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
