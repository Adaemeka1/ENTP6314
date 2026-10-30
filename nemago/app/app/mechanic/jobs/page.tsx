import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { MechanicJobs } from "@/components/MechanicJobs";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Job requests · NemaGo" };

export default async function MechanicJobsPage() {
  const { user, profile } = await requireProfile();
  if (profile.role !== "mechanic") redirect("/");
  // PRD F7: no mechanic gets jobs until verification is complete.
  if (!profile.mechanic_verified) redirect("/mechanic");

  const supabase = await createClient();
  const { data: mechanic } = await supabase
    .from("mechanics")
    .select("payouts_enabled")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell>
      <Link href="/mechanic" className="back-link">
        ← Back
      </Link>
      <h1>Job requests</h1>
      <p className="muted">Paid requests from drivers show up here live.</p>
      <MechanicJobs payoutsEnabled={Boolean(mechanic?.payouts_enabled)} />
    </AppShell>
  );
}
