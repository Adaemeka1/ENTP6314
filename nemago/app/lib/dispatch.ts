// Shared bits for the driver and mechanic dispatch screens.

// How long a driver waits after paying before we tell them honestly that nobody
// has accepted yet (PRD F3). A placeholder until the matching rules are decided.
export const WAIT_SECONDS = 120;

// ETA choices a mechanic can give when accepting (we have no live location yet).
export const ETA_CHOICES = [10, 20, 30, 45, 60];

type Contact = {
  address: string;
  driver_first_name: string | null;
  vehicle_vin: string | null;
  vehicle_plate: string | null;
};

// The three money buckets of a job (the job_transactions table).
export type Transaction = {
  dispatch_fee_cents: number;
  parts_total_cents: number;
  labor_and_diag_total_cents: number;
  mechanic_payout_cents: number;
};

// The NemaGo-paid parts order a mechanic picks up (the parts_orders table).
export type PartsOrder = {
  status: "preparing" | "ready" | "picked_up" | "cancelled";
  store_name: string | null;
  store_address: string | null;
  order_number: string | null;
};

// PostgREST returns an embedded table as an object, a list, or nothing.
type Embedded<T> = T | T[] | null;

export type DispatchRequest = {
  id: string;
  problem: string | null;
  area: string;
  // awaiting_payment: saved, not paid, hidden from mechanics
  // open: paid, visible to mechanics
  // accepted: a mechanic took it
  // arrived: the mechanic is on site (no more refunds from here)
  // diagnosed: the mechanic recorded a diagnosis (diagnosis jobs)
  status: "awaiting_payment" | "open" | "accepted" | "arrived" | "diagnosed" | "completed" | "cancelled";
  created_at: string;
  opened_at: string | null;
  accepted_at: string | null;
  arrived_at: string | null;
  diagnosis: string | null;
  diagnosed_at: string | null;
  eta_minutes: number | null;
  mechanic_first_name: string | null;
  price_cents: number | null;
  platform_fee_cents: number | null;
  payout_status: "none" | "pending" | "paid_out" | "failed";
  refund_status: "none" | "pending" | "refunded" | "failed";
  booking_type: "diagnosis" | "fixed_price";
  service_id: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_tier: 1 | 2 | 3 | null;
  // Only the driver and the mechanic who accepted can read these three.
  dispatch_contacts: Embedded<Contact>;
  job_transactions: Embedded<Transaction>;
  parts_orders: Embedded<PartsOrder>;
};

// Everything both screens need. Row Level Security decides which rows come back.
export const REQUEST_COLUMNS =
  "id, problem, area, status, created_at, opened_at, accepted_at, arrived_at, diagnosis, diagnosed_at, eta_minutes, mechanic_first_name, price_cents, platform_fee_cents, payout_status, refund_status, booking_type, service_id, vehicle_year, vehicle_make, vehicle_model, vehicle_tier, dispatch_contacts(address, driver_first_name, vehicle_vin, vehicle_plate), job_transactions(dispatch_fee_cents, parts_total_cents, labor_and_diag_total_cents, mechanic_payout_cents), parts_orders(status, store_name, store_address, order_number)";

function one<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function contactOf(request: DispatchRequest) {
  return one(request.dispatch_contacts);
}

export function transactionOf(request: DispatchRequest) {
  return one(request.job_transactions);
}

export function partsOrderOf(request: DispatchRequest) {
  return one(request.parts_orders);
}

// "2021 Ford F-150", or "" if the request has no vehicle (older requests).
export function vehicleLabel(request: DispatchRequest) {
  if (!request.vehicle_year || !request.vehicle_make || !request.vehicle_model) return "";
  return `${request.vehicle_year} ${request.vehicle_make} ${request.vehicle_model}`;
}

export function secondsSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
}

export function timeAgo(iso: string, now: number) {
  const s = secondsSince(iso, now);
  if (s < 10) return "just now";
  if (s < 60) return s + " seconds ago";
  const m = Math.floor(s / 60);
  return m + (m === 1 ? " minute ago" : " minutes ago");
}

// Sends a JSON request to one of our own payment routes.
export async function postJson(path: string, body: object) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, data };
  } catch {
    return { ok: false, data: {} as Record<string, unknown> };
  }
}

// The server sends short codes. These turn them into friendly sentences.
export function friendlyError(code: unknown) {
  switch (code) {
    case "already_active":
      return "You already have a request in progress.";
    case "already_taken":
      return "Another mechanic just took this job.";
    case "not_verified":
      return "Your mechanic account isn't verified yet.";
    case "payouts_not_set_up":
      return "Set up payouts first, then you can accept jobs.";
    case "cannot_cancel":
      return "This request can't be cancelled anymore.";
    case "cannot_arrive":
      return "This job can't be marked as arrived right now.";
    case "vin_required":
      return "Enter your 17-character VIN to book a diagnosis.";
    case "vehicle_id_required":
      return "Enter your VIN or license plate.";
    case "invalid_booking":
      return "Choose a service and try again.";
    case "cannot_quote":
      return "A repair quote can only be sent after you record the diagnosis.";
    case "quote_exists":
      return "You already sent a repair quote for this job.";
    case "invalid_quote":
      return "Please check the quote. Labor must be at least $80.00 and the balance due at least $1.00.";
    case "cannot_decline":
      return "This repair quote can't be declined anymore.";
    case "cannot_approve":
      return "This repair quote can't be approved right now.";
    case "invalid_input":
      return "Please check your answers and try again.";
    case "cannot_complete":
      return "This job can't be marked complete yet. Record your diagnosis first.";
    case "cannot_diagnose":
      return "A diagnosis can't be recorded for this job right now.";
    case "not_awaiting_payment":
      return "This request has already been paid or cancelled. Refresh the page.";
    case "payments_not_configured":
      return "Payments aren't switched on yet. Please try again later.";
    case "stripe_failed":
      return "We couldn't reach our payment provider. Please try again.";
    case "refund_failed":
      return "We couldn't send your refund automatically yet. Tap Retry refund.";
    case "payout_failed":
      return "The payout hit a problem. Tap Try payout again.";
    case "not_signed_in":
      return "Please sign in again.";
    default:
      return "Something went wrong. Please check your answers and try again.";
  }
}
