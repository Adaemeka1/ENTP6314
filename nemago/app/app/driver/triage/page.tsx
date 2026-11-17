import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TriageFlow } from "@/components/TriageFlow";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/vehicles";

export const metadata = { title: "Report a car problem · NemaGo" };

export default async function DriverTriage() {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");

  // The driver's own saved cars (Row Level Security shows only theirs). If the
  // vehicles table isn't set up yet this is simply empty and the step is skippable.
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, year, make, model, mileage")
    .order("created_at", { ascending: true });
  const vehicles = (data ?? []) as Vehicle[];

  return (
    <AppShell>
      <Link href="/driver" className="back-link">
        ← Back
      </Link>
      <h1>Report a car problem</h1>
      <p className="muted">
        Take a breath. Answer a few quick questions and we&rsquo;ll explain what&rsquo;s likely going on, in
        plain English, and whether it&rsquo;s safe to drive.
      </p>
      <p className="safety-note">
        If there&rsquo;s fire, smoke you can&rsquo;t explain, or you can&rsquo;t stop, move away from the car
        and call 911 first.
      </p>
      <TriageFlow vehicles={vehicles} />
    </AppShell>
  );
}
