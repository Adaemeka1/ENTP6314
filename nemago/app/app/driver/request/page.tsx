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
      <h1>Book a mechanic</h1>
      <p className="muted">
        Take a breath, you&rsquo;re in good hands. A verified mechanic can come to you, at a price that&rsquo;s
        locked before you pay.
      </p>
      <ul className="trust-row" style={{ justifyContent: "flex-start", margin: "0 0 12px" }}>
        <li>
          <span className="badge badge-success">Verified mechanics</span>
        </li>
        <li>
          <span className="badge badge-success">Price locked</span>
        </li>
        <li>
          <span className="badge badge-success">Secure payment</span>
        </li>
      </ul>
      <p className="safety-note">
        If you&rsquo;re in danger, move away from traffic and call 911 first. We&rsquo;ll be here when
        you&rsquo;re safe.
      </p>
      <DriverDispatch checkout={checkout} />
    </AppShell>
  );
}
