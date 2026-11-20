import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/stripe";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// Tips (Rating & Tip screen). 100% of a tip goes to the mechanic: NemaGo takes no
// platform fee. (NemaGo still pays Stripe's card-processing fee on the tip charge.)
//
// Flow, same safety rules as the job payment:
//   1. Driver chooses a tip -> /api/review saves it as "pending" and opens Stripe Checkout.
//   2. Only Stripe's signed webhook marks the tip paid.
//   3. The webhook then moves the full amount to the mechanic's Stripe account.
// Tips use their own transfer group ("tip_<id>") so they can never be mistaken for the
// job payout, which uses "dispatch_<id>".

const tipGroup = (requestId: string) => "tip_" + requestId;

// Creates the Stripe payment page for the tip the driver already chose.
// The amount is read from the saved review, never from the browser.
// Returns the Stripe URL, or an error code.
export async function createTipCheckout(args: {
  stripe: Stripe;
  admin: Admin;
  supabase: SupabaseClient;
  userId: string;
  email: string | undefined;
  request: Request;
  requestId: string;
}): Promise<{ url: string } | { error: "no_pending_tip" | "stripe_failed" }> {
  const { stripe, admin, supabase, userId, email, request, requestId } = args;

  // Row Level Security: a driver only ever gets their own review back.
  const { data: review } = await supabase
    .from("job_reviews")
    .select("tip_cents, tip_status")
    .eq("request_id", requestId)
    .maybeSingle();
  if (!review || review.tip_status !== "pending" || !review.tip_cents) return { error: "no_pending_tip" };

  const site = siteUrl(request);
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: review.tip_cents,
            product_data: {
              name: "Tip for your mechanic",
              description: "100% of your tip goes directly to your mechanic.",
            },
          },
        },
      ],
      client_reference_id: requestId,
      customer_email: email,
      metadata: { kind: "tip", dispatch_request_id: requestId },
      payment_intent_data: {
        metadata: { kind: "tip", dispatch_request_id: requestId },
        transfer_group: tipGroup(requestId),
      },
      success_url: site + "/driver/request?checkout=tip_success",
      cancel_url: site + "/driver/request?checkout=tip_cancelled",
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // Stripe needs at least 30 minutes
    });
  } catch (error) {
    console.error("tip: Stripe could not create a session", error);
    return { error: "stripe_failed" };
  }

  const { error: saveError } = await admin.rpc("admin_set_tip_checkout", {
    p_request_id: requestId,
    p_driver_id: userId,
    p_session_id: session.id,
  });
  if (saveError || !session.url) {
    console.error("tip: could not save the session", saveError?.message);
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // It will expire on its own.
    }
    return { error: saveError ? "no_pending_tip" : "stripe_failed" };
  }
  return { url: session.url };
}

type TipTransfer = {
  result: "transfer" | "already_sent" | "needs_refund" | "unknown_session";
  request_id?: string;
  amount_cents?: number;
  payment_intent_id?: string;
  stripe_account_id?: string | null;
};

// The webhook calls this when a tip checkout is paid. Throws if the money could not
// be moved yet, so Stripe retries the webhook. Safe to run more than once: the
// transfer is idempotent, so a mechanic is never tipped twice.
export async function handleTipPaid(stripe: Stripe, admin: Admin, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId || session.amount_total === null) {
    throw new Error("paid tip session " + session.id + " is missing its payment details");
  }

  const { data, error } = await admin.rpc("admin_mark_tip_paid", {
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId,
    p_amount_cents: session.amount_total,
  });
  if (error) throw new Error(error.message);
  const job = data as TipTransfer;

  // A payment we can't use (a duplicate, or the wrong amount): give it back.
  if (job.result === "needs_refund" || job.result === "unknown_session") {
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, metadata: { reason: job.result, session_id: session.id } },
      { idempotencyKey: "unused-tip-" + session.id },
    );
    await admin.rpc("admin_record_tip_refund", { p_session_id: session.id, p_refund_id: refund.id });
    return;
  }
  if (job.result !== "transfer") return; // already_sent

  if (!job.stripe_account_id || !job.request_id || !job.amount_cents) {
    throw new Error("tip " + session.id + ": the mechanic has no Stripe payout account yet");
  }

  const group = tipGroup(job.request_id);
  const existing = await stripe.transfers.list({ transfer_group: group, limit: 1 });
  let transferId = existing.data[0]?.id;

  if (!transferId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(job.payment_intent_id ?? paymentIntentId);
    const charge =
      typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;

    // The full tip. No platform fee is taken.
    const transfer = await stripe.transfers.create(
      {
        amount: job.amount_cents,
        currency: "usd",
        destination: job.stripe_account_id,
        source_transaction: charge ?? undefined,
        transfer_group: group,
        metadata: { kind: "tip", dispatch_request_id: job.request_id },
      },
      { idempotencyKey: "tip-" + session.id },
    );
    transferId = transfer.id;
  }

  const { error: finishError } = await admin.rpc("admin_finish_tip", {
    p_session_id: session.id,
    p_transfer_id: transferId,
  });
  if (finishError) throw new Error(finishError.message);
}
