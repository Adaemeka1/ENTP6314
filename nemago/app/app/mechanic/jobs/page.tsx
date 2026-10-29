import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { MechanicJobs } from "@/components/MechanicJobs";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Job requests · NemaGo" };

export default async function MechanicJobsPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "mechanic") redirect("/");
  // PRD F7: no mechanic gets jobs until verification is complete.
  if (!profile.mechanic_verified) redirect("/mechanic");

  return (
    <AppShell>
      <Link href="/mechanic" className="back-link">
        ← Back
      </Link>
      <h1>Job requests</h1>
      <p className="muted">New requests from drivers show up here live.</p>
      <MechanicJobs />
    </AppShell>
  );
}
