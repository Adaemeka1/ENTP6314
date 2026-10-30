import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { mechanicShareCents } from "@/lib/fees";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The accepting mechanic marks the job complete. NemaGo then pays the mechanic
// their share by moving it from the NemaGo Stripe balance to the mechanic's own
// Stripe account. The service fee simply stays in the NemaGo balance, which
// Stripe pays out to the NemaGo business bank account. Calling this again
// retries a payout that failed, and can never pay twice.
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

  const job = data as {
    price_cents: number;
    platform_fee_cents: number;
    payment_intent_id: string;
    session_id: string;
    stripe_account_id: string;
  };

  const share = mechanicShareCents(job.price_cents, job.platform_fee_cents);
  const group = "dispatch_" + requestId;

  try {
    if (share <= 0) throw new Error("the mechanic's share is not positive");

    // If a transfer for this job already exists (an earlier try got that far),
    // reuse it instead of paying again.
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
    return json({ ok: true, payout_status: "paid_out" });
  } catch (payoutError) {
    console.error("complete: payout failed for " + requestId, payoutError);
    await admin.rpc("admin_finish_payout", {
      p_request_id: requestId,
      p_session_id: job.session_id,
      p_transfer_id: null,
      p_ok: false,
    });
    return json({ error: "payout_failed" }, 502);
  }
}
