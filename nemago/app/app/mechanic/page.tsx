import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { firstName, requireProfile } from "@/lib/profile";

export const metadata = { title: "Mechanic · NemaGo" };

export default async function MechanicHome({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { user, profile } = await requireProfile();
  if (profile.role !== "mechanic") redirect("/");
  const passwordUpdated = (await searchParams).password === "updated";

  // PRD F7: no mechanic gets jobs until verification is complete.
  if (!profile.mechanic_verified) {
    return (
      <AppShell passwordUpdated={passwordUpdated}>
        <div className="pending">
          <span className="badge">Verification pending</span>
          <h1>Thanks for signing up, {firstName(profile, user.email)}</h1>
          <p className="muted">
            Before you can get jobs, our team needs to check a few things. You won’t see any jobs
            until this is done.
          </p>
          <ol className="steps">
            <li>Driver’s licence and photo ID</li>
            <li>Mechanic certifications (for example ASE)</li>
            <li>Insurance</li>
            <li>Background check</li>
          </ol>
          <p className="muted">Uploading documents is coming soon (F7). We’ll email you when you’re approved.</p>
        </div>
        <Link href="/mechanic/billing" className="card card-link">
          <strong>Billing</strong>
          <p className="muted">Your monthly platform subscription.</p>
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell passwordUpdated={passwordUpdated}>
      <h1>Hi {firstName(profile, user.email)}</h1>
      <span className="badge badge-success">Verified</span>
      <Link href="/mechanic/jobs" className="card card-link">
        <strong>Job requests</strong>
        <p className="muted">See new requests from drivers and accept them live.</p>
      </Link>
      <Link href="/mechanic/payouts" className="card card-link">
        <strong>Set Up Payouts</strong>
        <p className="muted">Link your bank account or debit card so you get paid for jobs.</p>
      </Link>
      <Link href="/mechanic/billing" className="card card-link">
        <strong>Billing</strong>
        <p className="muted">Your monthly platform subscription.</p>
      </Link>
      <div className="card card-disabled">
        <strong>Jobs near you</strong>
        <p className="muted">Pre-priced, pre-diagnosed jobs will show up here. Coming soon (F3).</p>
      </div>
    </AppShell>
  );
}
