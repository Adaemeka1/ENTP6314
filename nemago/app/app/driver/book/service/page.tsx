import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ServiceBooking } from "@/components/booking/ServiceBooking";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/vehicles";

export const metadata = { title: "Book a service · NemaGo" };

export default async function BookService() {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");

  // The driver's own saved cars (Row Level Security shows only theirs).
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, year, make, model, mileage")
    .order("created_at", { ascending: true });

  return (
    <AppShell>
      <Link href="/driver/request" className="back-link">
        ← Back
      </Link>
      <h1>I Know What I Need</h1>
      <p className="muted">
        Fixed prices for everyday fixes. Parts and labor are included, and there&rsquo;s no diagnosis fee.
      </p>
      <ServiceBooking vehicles={(data ?? []) as Vehicle[]} />
    </AppShell>
  );
}
