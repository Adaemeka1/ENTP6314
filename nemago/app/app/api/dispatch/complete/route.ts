import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { payMechanic, type PayoutJob } from "@/lib/payout";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The accepting mechanic marks the job complete. This is only allowed after they
// have recorded a diagnosis. NemaGo then pays the mechanic the $80.00 diagnostic
// fee; the $35.00 dispatch fee stays in the NemaGo balance. Calling this again
// retries a payout that failed (also for a job the driver cancelled after the
// diagnosis), and can never pay twice.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);
  const requestId = body.requestId;

  const { data, error } = await admin.rpc("admin_begin_completion", {
    p_request_id: requestId,
    p_mechanic_id: user.id,
  });
  if (error) return json({ error: safeError(error.message) }, 409);

  const paid = await payMechanic(stripe, admin, requestId, data as PayoutJob);
  return paid ? json({ ok: true, payout_status: "paid_out" }) : json({ error: "payout_failed" }, 502);
}
