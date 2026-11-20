import { getSignedInUser, json, notConfigured, readJson } from "@/lib/api";
import { createRepairCheckout } from "@/lib/repairPay";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// "Approve & Pay Balance": the driver approves the repair quote and is sent to Stripe
// Checkout for the balance. The amount comes from the saved quote, never from the
// browser. The repair is scheduled when Stripe's webhook confirms the payment.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);

  const result = await createRepairCheckout({
    stripe,
    admin,
    userId: user.id,
    email: user.email ?? undefined,
    request,
    requestId: body.requestId,
  });
  if ("error" in result) return json({ error: result.error }, result.error === "stripe_failed" ? 502 : 409);
  return json({ url: result.url });
}
