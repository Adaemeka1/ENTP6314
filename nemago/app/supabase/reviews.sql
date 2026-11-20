-- NemaGo: post-service Rating & Tip.
-- Run this once in the Supabase SQL Editor (it is safe to run again).
-- Run it AFTER booking.sql. Run it before deploying the Rating & Tip screen.
--
--   * job_reviews:  one star rating + quick tags + optional comment per completed
--                   job, plus the tip the driver chose and where it is up to.
--   * tip_payments: private Stripe records for tips (no one can read it from a
--                   browser, same as dispatch_payments).
--   * submit_review(): the driver saves a review once, after the job is completed.
--   * admin_*tip*():   server-only. A paid tip is moved 100% to the mechanic.
--                      NemaGo keeps nothing from it (0% platform fee).

-- ---------------------------------------------------------------------
-- 1. job_reviews
-- ---------------------------------------------------------------------
create table if not exists public.job_reviews (
  request_id uuid primary key references public.dispatch_requests (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  mechanic_id uuid references public.mechanics (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}'
    check (tags <@ array['on_time', 'photo_proof', 'clean_work', 'great_communication']),
  comment text check (comment is null or char_length(comment) <= 500),
  -- The tip the driver chose, in cents. 0 means no tip. $1 to $200 otherwise.
  tip_cents integer not null default 0 check (tip_cents = 0 or tip_cents between 100 and 20000),
  -- none: no tip.  pending: chosen but not paid yet.
  -- paid: paid, on its way to the mechanic.  sent: 100% transferred to the mechanic.
  tip_status text not null default 'none' check (tip_status in ('none', 'pending', 'paid', 'sent')),
  created_at timestamptz not null default now(),
  check ((tip_cents = 0) = (tip_status = 'none'))
);

alter table public.job_reviews enable row level security;
revoke all on public.job_reviews from anon, authenticated;
grant select on public.job_reviews to authenticated;
-- No insert, update or delete for users: reviews are saved by submit_review() only.

drop policy if exists "Drivers read own reviews" on public.job_reviews;
create policy "Drivers read own reviews"
  on public.job_reviews for select
  using (driver_id = auth.uid());

drop policy if exists "Mechanics read reviews of their jobs" on public.job_reviews;
create policy "Mechanics read reviews of their jobs"
  on public.job_reviews for select
  using (public.is_verified_mechanic() and mechanic_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. tip_payments: private Stripe records (no policies, no grants)
-- ---------------------------------------------------------------------
create table if not exists public.tip_payments (
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

create index if not exists tip_payments_request_idx on public.tip_payments (request_id);

alter table public.tip_payments enable row level security;
revoke all on public.tip_payments from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. The driver saves a review (once, only for their own completed job)
-- ---------------------------------------------------------------------
create or replace function public.submit_review(
  p_request_id uuid,
  p_rating integer,
  p_tags text[],
  p_comment text,
  p_tip_cents integer
)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_req public.dispatch_requests;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_tags text[] := coalesce(p_tags, '{}');
begin
  select * into v_req from public.dispatch_requests
    where id = p_request_id and driver_id = auth.uid() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_req.status <> 'completed' or v_req.mechanic_id is null then
    raise exception 'not_completed';
  end if;
  if exists (select 1 from public.job_reviews where request_id = p_request_id) then
    raise exception 'already_reviewed';
  end if;

  if p_rating is null or p_rating not between 1 and 5
     or not (v_tags <@ array['on_time', 'photo_proof', 'clean_work', 'great_communication'])
     or (v_comment is not null and char_length(v_comment) > 500)
     or p_tip_cents is null
     or not (p_tip_cents = 0 or p_tip_cents between 100 and 20000) then
    raise exception 'invalid_review';
  end if;

  insert into public.job_reviews
    (request_id, driver_id, mechanic_id, rating, tags, comment, tip_cents, tip_status)
  values
    (p_request_id, v_req.driver_id, v_req.mechanic_id, p_rating,
     (select coalesce(array_agg(distinct t), '{}') from unnest(v_tags) as t),
     v_comment, p_tip_cents, case when p_tip_cents > 0 then 'pending' else 'none' end);

  return 'saved';
end;
$$;

revoke all on function public.submit_review(uuid, integer, text[], text, integer) from public, anon;
grant execute on function public.submit_review(uuid, integer, text[], text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Server-only tip money functions
-- ---------------------------------------------------------------------

-- The server made a Stripe Checkout for the driver's chosen tip. Remember it.
-- The amount comes from the saved review, never from the browser.
create or replace function public.admin_set_tip_checkout(
  p_request_id uuid, p_driver_id uuid, p_session_id text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_review public.job_reviews;
begin
  select * into v_review from public.job_reviews
    where request_id = p_request_id and driver_id = p_driver_id for update;
  if not found or v_review.tip_status <> 'pending' then
    raise exception 'no_pending_tip';
  end if;
  insert into public.tip_payments (checkout_session_id, request_id, amount_cents)
    values (p_session_id, p_request_id, v_review.tip_cents)
    on conflict (checkout_session_id) do nothing;
end;
$$;

-- Stripe says a tip checkout was paid. Returns what the server should do next:
--   {"result": "transfer", ...}  send 100% to the mechanic (also returned again
--                                if an earlier attempt to transfer failed)
--   {"result": "already_sent"}   nothing to do (a retry of a finished tip)
--   {"result": "needs_refund"}   the money should go back (duplicate or wrong amount)
--   {"result": "unknown_session"} we have no record of it (refund too)
create or replace function public.admin_mark_tip_paid(
  p_session_id text, p_payment_intent_id text, p_amount_cents integer
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.tip_payments;
  v_review public.job_reviews;
  v_acct text;
begin
  select * into v_pay from public.tip_payments
    where checkout_session_id = p_session_id for update;
  if not found then
    return jsonb_build_object('result', 'unknown_session');
  end if;

  select * into v_review from public.job_reviews where request_id = v_pay.request_id for update;

  if v_pay.paid_at is null then
    update public.tip_payments
      set paid_at = now(), payment_intent_id = p_payment_intent_id
      where checkout_session_id = p_session_id;

    -- Only the first payment for the tip the driver chose is used.
    if v_review.tip_status <> 'pending'
       or v_review.tip_cents is distinct from p_amount_cents
       or v_pay.amount_cents is distinct from p_amount_cents then
      return jsonb_build_object('result', 'needs_refund');
    end if;

    update public.tip_payments set used = true where checkout_session_id = p_session_id;
    update public.job_reviews set tip_status = 'paid' where request_id = v_pay.request_id;
  elsif not v_pay.used then
    return jsonb_build_object('result', 'needs_refund');
  end if;

  if v_pay.transfer_id is not null then
    return jsonb_build_object('result', 'already_sent');
  end if;

  select stripe_account_id into v_acct from public.mechanics where id = v_review.mechanic_id;
  return jsonb_build_object(
    'result', 'transfer',
    'request_id', v_pay.request_id,
    'amount_cents', v_pay.amount_cents,
    'payment_intent_id', coalesce(v_pay.payment_intent_id, p_payment_intent_id),
    'stripe_account_id', v_acct
  );
end;
$$;

-- The tip reached the mechanic.
create or replace function public.admin_finish_tip(p_session_id text, p_transfer_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  update public.tip_payments set transfer_id = p_transfer_id
    where checkout_session_id = p_session_id and used
    returning request_id into v_request_id;
  if found then
    update public.job_reviews set tip_status = 'sent' where request_id = v_request_id;
  end if;
end;
$$;

-- A refund was issued for a tip payment we couldn't use.
create or replace function public.admin_record_tip_refund(p_session_id text, p_refund_id text)
returns void
language sql
security definer set search_path = ''
as $$
  update public.tip_payments set refund_id = p_refund_id where checkout_session_id = p_session_id;
$$;

-- ---------------------------------------------------------------------
-- 5. Lock the server-only functions to the server's secret key
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_set_tip_checkout(uuid, uuid, text)',
    'admin_mark_tip_paid(text, text, integer)',
    'admin_finish_tip(text, text)',
    'admin_record_tip_refund(text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
