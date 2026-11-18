import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { payMechanic, type PayoutJob } from "@/lib/payout";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The driver cancels.
//   Before the mechanic arrives: they get a full refund and nobody is paid.
//   After the mechanic arrives:  NO refund. The mechanic is paid their share if
//   they have not been already.
// Calling this again retries a refund or a payout that failed.
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
    refund?: boolean;
    unpaid_sessions?: string[];
    session_id?: string;
    payment_intent_id?: string;
    payout?: PayoutJob | null;
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

  // The mechanic had already arrived: no refund.
  if (info.refund === false) {
    // Nothing more to pay if they were already paid.
    if (!info.payout) return json({ ok: true, refunded: false, mechanic_paid: true });
    // The driver's cancellation is done either way. If the transfer fails it is
    // retried later (the mechanic can tap "Try payout again").
    const paid = await payMechanic(stripe, admin, requestId, info.payout);
    return json({ ok: true, refunded: false, mechanic_paid: paid });
  }

  // The mechanic had not arrived yet: full refund.
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
