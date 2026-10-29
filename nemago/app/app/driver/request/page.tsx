import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DriverDispatch } from "@/components/DriverDispatch";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Request a mechanic · NemaGo" };

export default async function DriverRequest() {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");

  return (
    <AppShell>
      <Link href="/driver" className="back-link">
        ← Back
      </Link>
      <h1>Request a mechanic</h1>
      <p className="muted">Tell us what&rsquo;s wrong and a verified mechanic can accept your job.</p>
      <DriverDispatch />
    </AppShell>
  );
}
