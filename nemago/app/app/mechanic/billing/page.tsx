import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FeeTable } from "@/components/FeeTable";
import { PaymentBox } from "@/components/PaymentBox";
import { MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH, formatDollars } from "@/lib/fees";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Billing · NemaGo" };

export default async function MechanicBilling() {
  const { profile } = await requireProfile();
  if (profile.role !== "mechanic") redirect("/");

  const price = formatDollars(MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH);

  return (
    <AppShell>
      <Link href="/mechanic" className="back-link">
        ← Back
      </Link>
      <h1>Billing</h1>
      <p className="muted">Your monthly NemaGo platform subscription.</p>
      <PaymentBox
        title="Platform subscription"
        amountText={price + " per month"}
        buttonText={"Subscribe for " + price + "/month"}
        doneText="Subscription started."
      />
      <FeeTable />
    </AppShell>
  );
}
