import { getSignedInUser, json, notConfigured, readJson, safeError } from "@/lib/api";
import { validateReview } from "@/lib/review";
import { createTipCheckout } from "@/lib/tip";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The driver rates a completed job (and optionally picks a tip).
//   1. The rating and review are saved first, once per job (submit_review in the database).
//   2. If a tip was chosen, a Stripe payment page for exactly that tip is created.
// The review is kept even if the tip payment is abandoned: the driver can finish the
// tip later from the same card (POST /api/tip).
export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = createAdminClient();
  if (!stripe || !admin) return notConfigured();

  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);
  const check = validateReview(body);
  if (!check.ok) return json({ error: "invalid_input", message: check.error }, 400);
  const v = check.value;

  const { error } = await supabase.rpc("submit_review", {
    p_request_id: body.requestId,
    p_rating: v.rating,
    p_tags: v.tags,
    p_comment: v.comment,
    p_tip_cents: v.tipCents,
  });
  if (error) return json({ error: safeError(error.message) }, 409);

  if (v.tipCents === 0) return json({ ok: true, url: null });

  const tip = await createTipCheckout({
    stripe,
    admin,
    supabase,
    userId: user.id,
    email: user.email ?? undefined,
    request,
    requestId: body.requestId,
  });
  if ("error" in tip) return json({ ok: true, url: null, tip_error: tip.error });
  return json({ ok: true, url: tip.url });
}
