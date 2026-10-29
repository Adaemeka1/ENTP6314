// Shared bits for the driver and mechanic dispatch screens.

// How long a driver waits before we tell them honestly that nobody has
// accepted yet (PRD F3). A placeholder until the matching rules are decided.
export const WAIT_SECONDS = 120;

// ETA choices a mechanic can give when accepting (we have no live location yet).
export const ETA_CHOICES = [10, 20, 30, 45, 60];

export type DispatchRequest = {
  id: string;
  problem: string | null;
  area: string;
  status: "open" | "accepted" | "cancelled";
  created_at: string;
  accepted_at: string | null;
  eta_minutes: number | null;
  mechanic_first_name: string | null;
  // The street address, only visible to the driver and the mechanic who accepted.
  dispatch_contacts:
    | { address: string; driver_first_name: string | null }
    | { address: string; driver_first_name: string | null }[]
    | null;
};

// Everything both screens need. Row Level Security decides which rows come back.
export const REQUEST_COLUMNS =
  "id, problem, area, status, created_at, accepted_at, eta_minutes, mechanic_first_name, dispatch_contacts(address, driver_first_name)";

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

// The database sends short codes. These turn them into friendly sentences.
export function friendlyError(message: string | undefined) {
  switch (message) {
    case "already_active":
      return "You already have a request in progress.";
    case "already_taken":
      return "Another mechanic just took this job.";
    case "not_verified":
      return "Your mechanic account isn't verified yet.";
    case "cannot_cancel":
      return "This request can't be cancelled anymore.";
    default:
      return "Something went wrong. Please check your answers and try again.";
  }
}
