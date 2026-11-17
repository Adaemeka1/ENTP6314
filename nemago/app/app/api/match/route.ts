import { getSignedInUser, json, notConfigured, readJson } from "@/lib/api";
import { rankMechanics, scoreMechanic, toPublic, type Candidate } from "@/lib/match";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type CandidateRow = {
  mechanic_id: string;
  first_name: string | null;
  certification_name: string | null;
  certification_expires_on: string | null;
};

// Smart Dispatch Match for a driver's own request.
//   Waiting for a mechanic: the top 3 eligible mechanics, ranked, with no names.
//   A mechanic has accepted: that mechanic's score breakdown, with their first name.
// This only READS. It never changes a request, a price or a payment.
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return notConfigured();

  const { supabase, user } = await getSignedInUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  const body = await readJson(request);
  if (!body || typeof body.requestId !== "string") return json({ error: "invalid_input" }, 400);

  // Only drivers, and only for their own request.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "driver") return json({ error: "not_a_driver" }, 403);

  const { data: job } = await supabase
    .from("dispatch_requests")
    .select("id, driver_id, problem, status, eta_minutes, mechanic_id")
    .eq("id", body.requestId)
    .maybeSingle();
  if (!job || job.driver_id !== user.id) return json({ error: "not_found" }, 404);
  if (job.status !== "open" && job.status !== "accepted" && job.status !== "diagnosed") {
    return json({ error: "not_matchable" }, 409);
  }

  // If the database file for matching hasn't been run yet, say so quietly: the
  // screen just hides the panel and everything else keeps working.
  const { data: rows, error } = await admin.rpc("admin_match_candidates");
  if (error) {
    console.error("match: could not list candidates", error.message);
    return json({ error: "match_unavailable" }, 503);
  }
  const people = (rows ?? []) as CandidateRow[];
  const candidates: Candidate[] = people.map((r) => ({
    id: r.mechanic_id,
    certificationName: r.certification_name,
    certificationExpiresOn: r.certification_expires_on,
  }));

  if (job.status === "open") {
    const top = rankMechanics(candidates, job.problem, job.id)
      .slice(0, 3)
      .map((m, i) => ({ label: "Mechanic " + (i + 1), ...toPublic(m) }));
    return json({ mode: "ranking", considered: candidates.length, matches: top });
  }

  // Accepted or diagnosed: explain why THIS mechanic was matched.
  const mine = candidates.find((c) => c.id === job.mechanic_id);
  if (!mine) return json({ mode: "matched", considered: candidates.length, rank: null, matches: [] });

  const result = scoreMechanic(mine, job.problem, job.id, { committedEtaMinutes: job.eta_minutes });
  const rank =
    1 + rankMechanics(candidates.filter((c) => c.id !== mine.id), job.problem, job.id).filter((m) => m.score > result.score).length;
  const firstName = people.find((p) => p.mechanic_id === mine.id)?.first_name ?? null;

  return json({
    mode: "matched",
    considered: candidates.length,
    rank,
    matches: [{ label: firstName ?? "Your mechanic", ...toPublic(result) }],
  });
}
