import { getSignedInUser, json, notConfigured } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Asks Stripe whether this mechanic can receive payouts yet, and saves the
// answer. Called when they come back from Stripe's onboarding page.
export async function POST() {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const { data: mechanic } = await supabase
    .from("mechanics")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!mechanic?.stripe_account_id) {
    return json({ hasAccount: false, payoutsEnabled: false });
  }

  try {
    const account = await stripe.accounts.retrieve(mechanic.stripe_account_id);
    const payoutsEnabled = account.capabilities?.transfers === "active" && account.payouts_enabled === true;

    const { error } = await admin.rpc("admin_set_connect_account", {
      p_mechanic_id: user.id,
      p_account_id: mechanic.stripe_account_id,
      p_payouts_enabled: payoutsEnabled,
    });
    if (error) throw new Error(error.message);

    return json({ hasAccount: true, payoutsEnabled, detailsSubmitted: account.details_submitted });
  } catch (error) {
    console.error("status: could not check the payout account", error);
    return json({ error: "stripe_failed" }, 502);
  }
}
