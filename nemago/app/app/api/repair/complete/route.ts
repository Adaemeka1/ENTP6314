import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { payRepairLabor, type RepairPayout } from "@/lib/repairPay";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The mechanic marks the approved repair as done. This closes the job and pays them 90%
// of the labor beyond the $80 diagnostic credit. (The parts are NemaGo's.) Calling it
// again retries a payout that failed, and can never pay twice.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);
  const requestId = body.requestId;

  const { data, error } = await admin.rpc("admin_begin_repair_completion", {
    p_request_id: requestId,
    p_mechanic_id: user.id,
  });
  if (error) return json({ error: safeError(error.message) }, 409);

  const payout = (data as { payout: RepairPayout | null }).payout;
  if (!payout) return json({ ok: true, payout_status: "paid_out" });

  const paid = await payRepairLabor(stripe, admin, requestId, payout);
  return paid ? json({ ok: true, payout_status: "paid_out" }) : json({ error: "payout_failed" }, 502);
}
