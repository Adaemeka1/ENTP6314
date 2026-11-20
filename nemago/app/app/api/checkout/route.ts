import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { validateBookingRequest } from "@/lib/booking";
import { DIAGNOSTIC_FEE_LABEL, DISPATCH_FEE_LABEL } from "@/lib/fees";
import { priceBooking, type Priced } from "@/lib/pricing";
import { shortServiceName } from "@/lib/services";
import { getStripe, siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// What the driver sees on Stripe's payment page: one line per money bucket.
function lineItems(priced: Priced) {
  const line = (name: string, description: string, cents: number) => ({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: cents,
      product_data: { name, description },
    },
  });

  const items = [];
  if (priced.type === "fixed_price" && priced.service && priced.tier) {
    items.push(
      line(
        "Tiered Labor",
        `${shortServiceName(priced.service)} · mobile mechanic labor, ${priced.tier.label} pricing`,
        priced.laborAndDiagCents,
      ),
    );
    if (priced.partsCents > 0) {
      items.push(
        line(
          "NemaGo Sourced Parts",
          "All parts are sourced directly by NemaGo using commercial-grade OEM/equivalent components matched to your VIN and backed by the manufacturer's warranty.",
          priced.partsCents,
        ),
      );
    }
  } else {
    items.push(
      line(
        DIAGNOSTIC_FEE_LABEL,
        "On-site diagnosis by a mobile mechanic. Credited toward the repair if you approve the repair quote.",
        priced.laborAndDiagCents,
      ),
    );
  }
  items.push(
    line(DISPATCH_FEE_LABEL, "Finding and dispatching a verified mobile mechanic to you", priced.dispatchFeeCents),
  );
  return items;
}

// Starts a booking (or resumes an unpaid one) and returns Stripe's payment page.
// EVERY price is worked out HERE from the service and the vehicle. Nothing the
// browser sends can change an amount: it is ignored.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body) return json({ error: "invalid_input" }, 400);

  let requestId: string;
  let priced: Priced | null;

  if (typeof body.requestId === "string") {
    // Paying for a booking that was saved but not paid yet. Only the driver's own
    // requests come back from this query.
    const { data } = await supabase
      .from("dispatch_requests")
      .select("id, status, booking_type, service_id, vehicle_make, vehicle_model")
      .eq("id", body.requestId)
      .maybeSingle();
    if (!data || data.status !== "awaiting_payment") {
      return json({ error: "not_awaiting_payment" }, 409);
    }
    requestId = data.id;
    priced =
      data.booking_type === "fixed_price"
        ? priceBooking({
            type: "fixed_price",
            serviceId: data.service_id ?? "",
            vehicle: { make: data.vehicle_make ?? "", model: data.vehicle_model ?? "" },
          })
        : priceBooking({ type: "diagnosis" });
  } else {
    const check = validateBookingRequest(body);
    if (!check.ok) return json({ error: "invalid_input", message: check.error }, 400);
    const v = check.value;

    const { data, error } = await supabase.rpc("request_booking", {
      p_booking_type: v.type,
      p_service_id: v.serviceId,
      p_problem: v.problem,
      p_area: v.area,
      p_address: v.address,
      p_year: v.year,
      p_make: v.make,
      p_model: v.model,
      p_vin: v.vin,
      p_plate: v.plate,
    });
    if (error) return json({ error: safeError(error.message) }, 409);
    requestId = data as string;

    priced =
      v.type === "fixed_price"
        ? priceBooking({
            type: "fixed_price",
            serviceId: v.serviceId as string,
            vehicle: { make: v.make, model: v.model },
          })
        : priceBooking({ type: "diagnosis" });
  }

  if (!priced) return json({ error: "invalid_input" }, 400);
  const site = siteUrl(request);

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems(priced),
      client_reference_id: requestId,
      customer_email: user.email ?? undefined,
      metadata: { dispatch_request_id: requestId, booking_type: priced.type },
      payment_intent_data: {
        metadata: { dispatch_request_id: requestId, booking_type: priced.type },
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

  // The database records the three buckets and works out the 90/10 split.
  const { error: saveError } = await admin.rpc("admin_set_checkout_v2", {
    p_request_id: requestId,
    p_driver_id: user.id,
    p_session_id: session.id,
    p_dispatch_fee_cents: priced.dispatchFeeCents,
    p_parts_total_cents: priced.partsCents,
    p_labor_and_diag_cents: priced.laborAndDiagCents,
    p_tier: priced.tier?.tier ?? null,
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
