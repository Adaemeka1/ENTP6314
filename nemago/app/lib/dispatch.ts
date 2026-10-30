// Shared bits for the driver and mechanic dispatch screens.

// How long a driver waits after paying before we tell them honestly that nobody
// has accepted yet (PRD F3). A placeholder until the matching rules are decided.
export const WAIT_SECONDS = 120;

// ETA choices a mechanic can give when accepting (we have no live location yet).
export const ETA_CHOICES = [10, 20, 30, 45, 60];

export type DispatchRequest = {
  id: string;
  problem: string | null;
  area: string;
  // awaiting_payment: saved, not paid, hidden from mechanics
  // open: paid, visible to mechanics
  // accepted: a mechanic took it
  status: "awaiting_payment" | "open" | "accepted" | "completed" | "cancelled";
  created_at: string;
  opened_at: string | null;
  accepted_at: string | null;
  eta_minutes: number | null;
  mechanic_first_name: string | null;
  price_cents: number | null;
  platform_fee_cents: number | null;
  payout_status: "none" | "pending" | "paid_out" | "failed";
  refund_status: "none" | "pending" | "refunded" | "failed";
  // The street address, only visible to the driver and the mechanic who accepted.
  dispatch_contacts:
    | { address: string; driver_first_name: string | null }
    | { address: string; driver_first_name: string | null }[]
    | null;
};

// Everything both screens need. Row Level Security decides which rows come back.
export const REQUEST_COLUMNS =
  "id, problem, area, status, created_at, opened_at, accepted_at, eta_minutes, mechanic_first_name, price_cents, platform_fee_cents, payout_status, refund_status, dispatch_contacts(address, driver_first_name)";

export function contactOf(request: DispatchRequest) {
  const c = request.dispatch_contacts;
  return Array.isArray(c) ? (c[0] ?? null) : c;
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
    case "cannot_complete":
      return "This job can't be marked complete.";
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
