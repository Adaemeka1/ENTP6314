import type Stripe from "stripe";
import { json, notConfigured } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Stripe calls this address whenever something happens to a payment. It is the
// ONLY thing that marks a request as paid. Anyone could post to this address,
// so the first job is to check Stripe's signature. If it doesn't match the
// secret only Stripe and we know, the message is thrown away.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !secret) return notConfigured();

  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "missing_signature" }, 400);

  // The signature is calculated from the exact raw text, so read it as text.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return json({ error: "bad_signature" }, 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handlePaid(stripe, admin, event.data.object);
    } else if (event.type === "checkout.session.expired") {
      const { error } = await admin.rpc("admin_expire_checkout", {
        p_session_id: event.data.object.id,
      });
      if (error) throw new Error(error.message);
    }
    // Any other event type is not ours to handle. Say "got it" so Stripe stops sending it.
    return json({ received: true });
  } catch (error) {
    // A 500 makes Stripe try again later.
    console.error("webhook: failed to handle " + event.type, error);
    return json({ error: "handler_failed" }, 500);
  }
}

async function handlePaid(
  stripe: Stripe,
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  session: Stripe.Checkout.Session,
) {
  if (session.payment_status !== "paid") return;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId || session.amount_total === null) {
    throw new Error("paid session " + session.id + " is missing its payment details");
  }

  const { data, error } = await admin.rpc("admin_mark_paid", {
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId,
    p_amount_cents: session.amount_total,
  });
  if (error) throw new Error(error.message);

  // The money arrived but we can't use it (the request was cancelled, this is a
  // second payment for the same request, or the amount was wrong). Give it back.
  if (data === "needs_refund" || data === "unknown_session") {
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, metadata: { reason: String(data), session_id: session.id } },
      { idempotencyKey: "unused-payment-" + session.id },
    );
    await admin.rpc("admin_record_refund", { p_session_id: session.id, p_refund_id: refund.id });
  }
}
