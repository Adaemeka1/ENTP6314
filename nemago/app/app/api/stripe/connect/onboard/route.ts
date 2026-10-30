import { getSignedInUser, json, notConfigured } from "@/lib/api";
import { CONNECT_COUNTRY, getStripe, siteUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// "Set Up Payouts": makes sure the mechanic has a Stripe connected account, then
// returns a one-time link to Stripe's own onboarding page. Stripe collects and
// keeps their bank or debit card and identity details. NemaGo never sees them.
//
// Uses Stripe's Accounts v2 (the older "type: express" method is no longer
// allowed for new platforms). NemaGo collects the fees and is responsible for
// losses, which needs the "Refunds and chargebacks liability acknowledgement" to
// be accepted once in the Stripe Dashboard (Settings -> Connect -> Platform profile).
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
      const account = await stripe.v2.core.accounts.create(
        {
          contact_email: user.email ?? undefined,
          identity: { country: CONNECT_COUNTRY },
          dashboard: "express",
          defaults: {
            currency: "usd",
            responsibilities: { fees_collector: "application", losses_collector: "application" },
          },
          // The mechanic only needs to RECEIVE transfers from NemaGo.
          configuration: {
            recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
          },
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
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: site + "/mechanic/payouts?refresh=1",
          return_url: site + "/mechanic/payouts?return=1",
        },
      },
    });
    return json({ url: link.url });
  } catch (error) {
    console.error("onboard: Stripe could not start payout setup", error);
    return json({ error: "stripe_failed" }, 502);
  }
}
