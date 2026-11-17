import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DriverDispatch } from "@/components/DriverDispatch";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/vehicles";

export const metadata = { title: "Request a mechanic · NemaGo" };

export default async function DriverRequest({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; from?: string; vehicle?: string }>;
}) {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");
  const { checkout, from, vehicle } = await searchParams;

  // The driver's own saved cars (Row Level Security shows only theirs). If the
  // vehicles table isn't set up yet this is just empty and the picker is hidden.
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, year, make, model, mileage")
    .order("created_at", { ascending: true });
  const vehicles = (data ?? []) as Vehicle[];
  const initialVehicleId = vehicles.some((v) => v.id === vehicle) ? (vehicle as string) : null;

  return (
    <AppShell>
      <Link href="/driver" className="back-link">
        ← Back
      </Link>
      <h1>Request a mechanic</h1>
      <p className="muted">
        Take a breath, you&rsquo;re in good hands. Tell us what&rsquo;s wrong, and a verified mechanic can
        come to you at a price that&rsquo;s locked before you pay.
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
      <DriverDispatch
        checkout={checkout}
        vehicles={vehicles}
        initialVehicleId={initialVehicleId}
        fromTriage={from === "triage"}
      />
    </AppShell>
  );
}
