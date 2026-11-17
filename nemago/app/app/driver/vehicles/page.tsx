import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { VehicleManager } from "@/components/VehicleManager";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/vehicles";

export const metadata = { title: "My vehicles · NemaGo" };

export default async function DriverVehicles() {
  const { user, profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");

  // Row Level Security in the database returns only this driver's own cars.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, year, make, model, mileage")
    .order("created_at", { ascending: true });

  return (
    <AppShell>
      <Link href="/driver" className="back-link">
        ← Back
      </Link>
      <h1>My vehicles</h1>
      <p className="muted">
        Save your car once. You can pick it when you report a problem or request a mechanic.
      </p>
      <VehicleManager driverId={user.id} initial={(data ?? []) as Vehicle[]} setupProblem={Boolean(error)} />
    </AppShell>
  );
}
