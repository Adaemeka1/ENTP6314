import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { firstName, requireProfile } from "@/lib/profile";

export const metadata = { title: "Home · NemaGo" };

export default async function DriverHome({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { user, profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");

  return (
    <AppShell passwordUpdated={(await searchParams).password === "updated"}>
      <h1>Hi {firstName(profile, user.email)} 👋</h1>
      <p className="muted">What’s going on with your car?</p>

      <Link href="/driver/chat" className="card card-link">
        <strong>Ask the Car Helper</strong>
        <p className="muted">Type what&rsquo;s wrong and get a plain-English answer.</p>
      </Link>
      <Link href="/driver/pay" className="card card-link">
        <strong>Pay dispatch fee</strong>
        <p className="muted">One flat fee to send a mechanic to you.</p>
      </Link>

      <div className="card card-disabled">
        <strong>Report a car problem</strong>
        <p className="muted">Photos, warning lights or a fault code. Coming soon (F1).</p>
      </div>
      <div className="card card-disabled">
        <strong>My vehicles</strong>
        <p className="muted">Add your car by VIN or year, make and model. Coming soon (F1).</p>
      </div>
    </AppShell>
  );
}
