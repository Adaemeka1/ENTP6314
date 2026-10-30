import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DriverDispatch } from "@/components/DriverDispatch";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Request a mechanic · NemaGo" };

export default async function DriverRequest({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");
  const { checkout } = await searchParams;

  return (
    <AppShell>
      <Link href="/driver" className="back-link">
        ← Back
      </Link>
      <h1>Request a mechanic</h1>
      <p className="muted">Tell us what&rsquo;s wrong, pay securely, and a verified mechanic can accept your job.</p>
      <DriverDispatch checkout={checkout} />
    </AppShell>
  );
}
