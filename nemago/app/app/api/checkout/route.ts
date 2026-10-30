import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { SERVICE_PRICE_CENTS, platformFeeCents } from "@/lib/fees";
import { getStripe, siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Checks a piece of text from the browser, and trims it.
function text(value: unknown, min: number, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

// "Confirm Dispatch": saves the request as unpaid, then creates a real Stripe
// Checkout Session and returns its address. The price is chosen HERE, on the
// server. Nothing the browser sends can change it.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body) return json({ error: "invalid_input" }, 400);

  let requestId: string;

  if (typeof body.requestId === "string") {
    // Paying for a request that was saved but not paid yet. Only the driver's own
    // requests come back from this query.
    const { data } = await supabase
      .from("dispatch_requests")
      .select("id, status")
      .eq("id", body.requestId)
      .maybeSingle();
    if (!data || data.status !== "awaiting_payment") {
      return json({ error: "not_awaiting_payment" }, 409);
    }
    requestId = data.id;
  } else {
    const problem = text(body.problem, 3, 500);
    const area = text(body.area, 2, 80);
    const address = text(body.address, 3, 200);
    if (!problem || !area || !address) return json({ error: "invalid_input" }, 400);

    const { data, error } = await supabase.rpc("request_dispatch", {
      p_problem: problem,
      p_area: area,
      p_address: address,
    });
    if (error) return json({ error: safeError(error.message) }, 409);
    requestId = data as string;
  }

  const price = SERVICE_PRICE_CENTS;
  const fee = platformFeeCents(price);
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
            unit_amount: price,
            product_data: {
              name: "Roadside service",
              description: "On-demand mobile mechanic dispatch (test mode)",
            },
          },
        },
      ],
      client_reference_id: requestId,
      customer_email: user.email ?? undefined,
      metadata: { dispatch_request_id: requestId },
      payment_intent_data: {
        metadata: { dispatch_request_id: requestId },
        transfer_group: "dispatch_" + requestId,
      },
      success_url: site + "/driver/request?checkout=success",
      cancel_url: site + "/driver/request?checkout=cancelled",
      // Stripe needs at least 30 minutes.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });
  } catch (error) {
    console.error("checkout: Stripe could not create a session", error);
    return json({ error: "stripe_failed" }, 502);
  }

  const { error: saveError } = await admin.rpc("admin_set_checkout", {
    p_request_id: requestId,
    p_driver_id: user.id,
    p_session_id: session.id,
    p_price_cents: price,
    p_fee_cents: fee,
  });
  if (saveError) {
    console.error("checkout: could not save the session", saveError.message);
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // It will expire on its own.
    }
    return json({ error: safeError(saveError.message) }, 500);
  }

  return json({ url: session.url });
}
