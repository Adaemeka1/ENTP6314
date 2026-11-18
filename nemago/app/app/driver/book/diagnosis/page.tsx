import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DiagnosisBooking } from "@/components/booking/DiagnosisBooking";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/vehicles";

export const metadata = { title: "Book a diagnosis · NemaGo" };

export default async function BookDiagnosis({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; vehicle?: string }>;
}) {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");
  const { from, vehicle } = await searchParams;

  // The driver's own saved cars (Row Level Security shows only theirs).
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, year, make, model, mileage")
    .order("created_at", { ascending: true });
  const vehicles = (data ?? []) as Vehicle[];

  return (
    <AppShell>
      <Link href="/driver/request" className="back-link">
        ← Back
      </Link>
      <h1>Something Is Wrong</h1>
      <p className="muted">
        Take a breath. Tell us about your car and what&rsquo;s happening, and a verified mechanic will come to
        you to diagnose it.
      </p>
      <p className="safety-note">
        If there&rsquo;s fire, smoke you can&rsquo;t explain, or you can&rsquo;t stop, move away from the car and
        call 911 first.
      </p>
      <DiagnosisBooking
        vehicles={vehicles}
        fromTriage={from === "triage"}
        initialVehicleId={vehicles.some((v) => v.id === vehicle) ? (vehicle as string) : null}
      />
    </AppShell>
  );
}
