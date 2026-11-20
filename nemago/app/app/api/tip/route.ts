import { getSignedInUser, json, notConfigured, readJson } from "@/lib/api";
import { createTipCheckout } from "@/lib/tip";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Finishes a tip the driver already chose on their review but didn't pay yet
// (for example they closed Stripe's page). The amount is the one saved with the
// review: nothing the browser sends can change it.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);

  const tip = await createTipCheckout({
    stripe,
    admin,
    supabase,
    userId: user.id,
    email: user.email ?? undefined,
    request,
    requestId: body.requestId,
  });
  if ("error" in tip) return json({ error: tip.error }, tip.error === "stripe_failed" ? 502 : 409);
  return json({ url: tip.url });
}
