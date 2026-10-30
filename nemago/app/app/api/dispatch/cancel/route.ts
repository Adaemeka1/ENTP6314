import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The driver cancels. If they already paid, they get a full refund, and nobody
// is paid out. Calling this again retries a refund that failed.
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return notConfigured();

  const { user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);
  const requestId = body.requestId;

  const { data, error } = await admin.rpc("admin_begin_cancel", {
    p_request_id: requestId,
    p_driver_id: user.id,
  });
  if (error) return json({ error: safeError(error.message) }, 409);

  const info = data as {
    was_paid: boolean;
    unpaid_sessions?: string[];
    session_id?: string;
    payment_intent_id?: string;
  };
  const stripe = getStripe();

  if (!info.was_paid) {
    // Close any unpaid checkout pages so they can't be paid by mistake. If one
    // slips through, the webhook refunds it automatically.
    if (stripe) {
      for (const id of info.unpaid_sessions ?? []) {
        try {
          await stripe.checkout.sessions.expire(id);
        } catch {
          // Already closed or expired.
        }
      }
    }
    return json({ ok: true, refunded: false });
  }

  if (!stripe) return notConfigured();

  try {
    const refund = await stripe.refunds.create(
      { payment_intent: info.payment_intent_id!, metadata: { dispatch_request_id: requestId } },
      { idempotencyKey: "refund-" + requestId },
    );
    await admin.rpc("admin_finish_refund", {
      p_request_id: requestId,
      p_session_id: info.session_id,
      p_refund_id: refund.id,
      p_ok: true,
    });
    return json({ ok: true, refunded: true });
  } catch (refundError) {
    console.error("cancel: refund failed for " + requestId, refundError);
    await admin.rpc("admin_finish_refund", {
      p_request_id: requestId,
      p_session_id: info.session_id,
      p_refund_id: null,
      p_ok: false,
    });
    return json({ error: "refund_failed" }, 502);
  }
}
