import { getSignedInUser, json, notConfigured } from "@/lib/api";
import { CONNECT_COUNTRY, getStripe, siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// "Set Up Payouts": makes sure the mechanic has a Stripe Express account, then
// returns a one-time link to Stripe's own onboarding page. Stripe collects and
// keeps their bank or debit card and identity details. NemaGo never sees them.
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  // PRD F7: only verified mechanics.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, mechanic_verified")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "mechanic" || !profile.mechanic_verified) {
    return json({ error: "not_verified" }, 403);
  }

  const { data: mechanic } = await supabase
    .from("mechanics")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  try {
    let accountId = mechanic?.stripe_account_id ?? null;

    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          country: CONNECT_COUNTRY,
          email: user.email ?? undefined,
          business_type: "individual",
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { mechanic_id: user.id },
        },
        { idempotencyKey: "express-account-" + user.id },
      );
      accountId = account.id;
      const { error } = await admin.rpc("admin_set_connect_account", {
        p_mechanic_id: user.id,
        p_account_id: accountId,
        p_payouts_enabled: false,
      });
      if (error) throw new Error(error.message);
    }

    const site = siteUrl(request);
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: site + "/mechanic/payouts?refresh=1",
      return_url: site + "/mechanic/payouts?return=1",
    });
    return json({ url: link.url });
  } catch (error) {
    console.error("onboard: Stripe could not start payout setup", error);
    return json({ error: "stripe_failed" }, 502);
  }
}
