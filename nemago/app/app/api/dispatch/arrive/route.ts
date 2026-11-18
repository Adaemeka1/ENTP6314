import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { payMechanic, type PayoutJob } from "@/lib/payout";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The accepting mechanic taps "I've arrived".
//   Diagnosis job:    they are paid their 90% of the diagnosis fee now, and the
//                     customer can no longer get a refund.
//   Fixed-price job:  nothing is paid yet (the labor is paid on completion), but the
//                     customer can no longer get a refund.
// Tapping again retries a diagnosis payout that failed, and can never pay twice.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);
  const requestId = body.requestId;

  const { data, error } = await admin.rpc("admin_begin_arrival", {
    p_request_id: requestId,
    p_mechanic_id: user.id,
  });
  if (error) return json({ error: safeError(error.message) }, 409);

  const payout = (data as { payout: PayoutJob | null }).payout;
  if (!payout) return json({ ok: true, payout_status: "none" });

  const paid = await payMechanic(stripe, admin, requestId, payout);
  return paid ? json({ ok: true, payout_status: "paid_out" }) : json({ error: "payout_failed" }, 502);
}
