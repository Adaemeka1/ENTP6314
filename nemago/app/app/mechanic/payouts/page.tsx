import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PayoutsCard } from "@/components/PayoutsCard";
import { requireProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Payouts · NemaGo" };

export default async function MechanicPayouts({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; refresh?: string }>;
}) {
  const { user, profile } = await requireProfile();
  if (profile.role !== "mechanic") redirect("/");
  // PRD F7: payouts are only for verified mechanics.
  if (!profile.mechanic_verified) redirect("/mechanic");

  const supabase = await createClient();
  const { data: mechanic } = await supabase
    .from("mechanics")
    .select("stripe_account_id, payouts_enabled")
    .eq("id", user.id)
    .maybeSingle();

  const params = await searchParams;

  return (
    <AppShell>
      <Link href="/mechanic" className="back-link">
        ← Back
      </Link>
      <h1>Payouts</h1>
      <p className="muted">How you get paid for completed jobs.</p>
      <PayoutsCard
        hasAccount={Boolean(mechanic?.stripe_account_id)}
        payoutsEnabled={Boolean(mechanic?.payouts_enabled)}
        returned={params.return === "1" || params.refresh === "1"}
      />
    </AppShell>
  );
}
