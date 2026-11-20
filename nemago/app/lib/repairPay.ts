import type Stripe from "stripe";
import { DIAGNOSTIC_FEE_CENTS, formatCents } from "@/lib/fees";
import { siteUrl } from "@/lib/stripe";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// Repair quote money (the Secondary Approval Gate). Same safety rules as the job payment:
//   * the amount is read from the saved quote, never from the browser;
//   * only Stripe's signed webhook marks the balance paid;
//   * the mechanic is paid when they mark the repair complete, 90% of (labor - $80);
//   * the parts are 100% NemaGo's and the 10% labor cut stays in NemaGo's balance.
// Repairs use their own transfer group ("repair_<id>"), so they can never be mistaken
// for the diagnosis payout ("dispatch_<id>") or a tip ("tip_<id>").

const repairGroup = (requestId: string) => "repair_" + requestId;

// Opens Stripe Checkout for the balance due on the driver's quote.
export async function createRepairCheckout(args: {
  stripe: Stripe;
  admin: Admin;
  userId: string;
  email: string | undefined;
  request: Request;
  requestId: string;
}): Promise<{ url: string } | { error: "cannot_approve" | "stripe_failed" }> {
  const { stripe, admin, userId, email, request, requestId } = args;

  const { data, error } = await admin.rpc("admin_begin_repair_checkout", {
    p_request_id: requestId,
    p_driver_id: userId,
  });
  if (error || !data) return { error: "cannot_approve" };
  const money = data as { parts_cents: number; labor_net_cents: number; net_due_cents: number };

  const line = (name: string, description: string, cents: number) => ({
    quantity: 1,
    price_data: { currency: "usd", unit_amount: cents, product_data: { name, description } },
  });
  const items = [];
  if (money.parts_cents > 0) {
    items.push(
      line(
        "NemaGo Sourced Parts",
        "All parts are sourced directly by NemaGo using commercial-grade OEM/equivalent components matched to your VIN and backed by the manufacturer's warranty.",
        money.parts_cents,
      ),
    );
  }
  if (money.labor_net_cents > 0) {
    items.push(
      line(
        "Repair Labor",
        `Mobile mechanic repair labor, after your ${formatCents(DIAGNOSTIC_FEE_CENTS)} diagnostic credit`,
        money.labor_net_cents,
      ),
    );
  }

  const site = siteUrl(request);
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items,
      client_reference_id: requestId,
      customer_email: email,
      metadata: { kind: "repair", dispatch_request_id: requestId },
      payment_intent_data: {
        metadata: { kind: "repair", dispatch_request_id: requestId },
        transfer_group: repairGroup(requestId),
      },
      success_url: site + "/driver/request?checkout=repair_success",
      cancel_url: site + "/driver/request?checkout=repair_cancelled",
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // Stripe needs at least 30 minutes
    });
  } catch (err) {
    console.error("repair: Stripe could not create a session", err);
    return { error: "stripe_failed" };
  }

  const { error: saveError } = await admin.rpc("admin_set_repair_checkout", {
    p_request_id: requestId,
    p_driver_id: userId,
    p_session_id: session.id,
  });
  if (saveError || !session.url) {
    console.error("repair: could not save the session", saveError?.message);
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // It will expire on its own.
    }
    return { error: saveError ? "cannot_approve" : "stripe_failed" };
  }
  return { url: session.url };
}

// The webhook calls this when a repair checkout is paid. A payment we can't use
// (the quote was withdrawn or declined, a second payment, or the wrong amount) is refunded.
export async function handleRepairPaid(stripe: Stripe, admin: Admin, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId || session.amount_total === null) {
    throw new Error("paid repair session " + session.id + " is missing its payment details");
  }

  const { data, error } = await admin.rpc("admin_mark_repair_paid", {
    p_session_id: session.id,
    p_payment_intent_id: paymentIntentId,
    p_amount_cents: session.amount_total,
  });
  if (error) throw new Error(error.message);

  if (data === "needs_refund" || data === "unknown_session") {
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId, metadata: { reason: String(data), session_id: session.id } },
      { idempotencyKey: "unused-repair-" + session.id },
    );
    await admin.rpc("admin_record_repair_refund", { p_session_id: session.id, p_refund_id: refund.id });
  }
}

export type RepairPayout = {
  amount_cents: number;
  payment_intent_id: string;
  session_id: string;
  stripe_account_id: string;
};

// Pays the mechanic their share of the repair (90% of labor beyond the $80 credit).
// Safe to call again after a failure: it reuses an existing transfer and uses an
// idempotency key, so the mechanic is never paid twice. Returns true if they are paid.
export async function payRepairLabor(
  stripe: Stripe,
  admin: Admin,
  requestId: string,
  payout: RepairPayout,
): Promise<boolean> {
  const group = repairGroup(requestId);
  try {
    if (payout.amount_cents <= 0) throw new Error("the mechanic's repair share is not positive");

    const existing = await stripe.transfers.list({ transfer_group: group, limit: 1 });
    let transferId = existing.data[0]?.id;

    if (!transferId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(payout.payment_intent_id);
      const charge =
        typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;
      const transfer = await stripe.transfers.create(
        {
          amount: payout.amount_cents,
          currency: "usd",
          destination: payout.stripe_account_id,
          source_transaction: charge ?? undefined,
          transfer_group: group,
          metadata: { kind: "repair", dispatch_request_id: requestId },
        },
        { idempotencyKey: "repair-payout-" + payout.session_id },
      );
      transferId = transfer.id;
    }

    await admin.rpc("admin_finish_repair_payout", {
      p_request_id: requestId,
      p_session_id: payout.session_id,
      p_transfer_id: transferId,
      p_ok: true,
    });
    return true;
  } catch (err) {
    console.error("repair payout failed for " + requestId, err);
    await admin.rpc("admin_finish_repair_payout", {
      p_request_id: requestId,
      p_session_id: payout.session_id,
      p_transfer_id: null,
      p_ok: false,
    });
    return false;
  }
}
