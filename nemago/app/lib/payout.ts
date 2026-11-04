import type Stripe from "stripe";
import { mechanicShareCents } from "@/lib/fees";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// What the database tells the server it needs to pay a mechanic.
export type PayoutJob = {
  price_cents: number;
  platform_fee_cents: number;
  payment_intent_id: string;
  session_id: string;
  stripe_account_id: string;
};

// Pays the mechanic their share ($80.00) by moving it from the NemaGo Stripe
// balance to the mechanic's own Stripe account. NemaGo's $35.00 simply stays in
// the NemaGo balance. Safe to call again after a failure: it reuses an existing
// transfer and uses an idempotency key, so a mechanic is never paid twice.
// Returns true if the mechanic has been paid.
export async function payMechanic(
  stripe: Stripe,
  admin: Admin,
  requestId: string,
  job: PayoutJob,
): Promise<boolean> {
  const share = mechanicShareCents(job.price_cents, job.platform_fee_cents);
  const group = "dispatch_" + requestId;

  try {
    if (share <= 0) throw new Error("the mechanic's share is not positive");

    const existing = await stripe.transfers.list({ transfer_group: group, limit: 1 });
    let transferId = existing.data[0]?.id;

    if (!transferId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(job.payment_intent_id);
      const charge =
        typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id;

      const transfer = await stripe.transfers.create(
        {
          amount: share,
          currency: "usd",
          destination: job.stripe_account_id,
          source_transaction: charge ?? undefined,
          transfer_group: group,
          metadata: { dispatch_request_id: requestId },
        },
        { idempotencyKey: "payout-" + requestId },
      );
      transferId = transfer.id;
    }

    await admin.rpc("admin_finish_payout", {
      p_request_id: requestId,
      p_session_id: job.session_id,
      p_transfer_id: transferId,
      p_ok: true,
    });
    return true;
  } catch (error) {
    console.error("payout failed for " + requestId, error);
    await admin.rpc("admin_finish_payout", {
      p_request_id: requestId,
      p_session_id: job.session_id,
      p_transfer_id: null,
      p_ok: false,
    });
    return false;
  }
}
