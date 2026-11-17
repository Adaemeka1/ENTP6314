import { getSignedInUser, json, readJson } from "@/lib/api";
import { DEMO_TRIAGE_NOTE, parseTriageInput, runTriage } from "@/lib/triage";

export const runtime = "nodejs";

// Guided triage for a driver. It only READS and CALCULATES: it never creates a
// request, a price or a payment.
//
// There is no AI vision model behind this yet, so every answer is the rule-based
// DEMO triage in lib/triage.ts and is labelled as such. (Photos are never sent
// here.) When a vision provider is approved and configured, it plugs in at this
// spot, behind the same request and response shape.
export async function POST(request: Request) {
  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "driver") return json({ error: "not_a_driver" }, 403);

  const body = await readJson(request);
  if (!body) return json({ error: "invalid_input" }, 400);
  const parsed = parseTriageInput(body);
  if (!parsed.ok) return json({ error: "invalid_input" }, 400);

  return json({ source: "demo", note: DEMO_TRIAGE_NOTE, result: runTriage(parsed.value) });
}
