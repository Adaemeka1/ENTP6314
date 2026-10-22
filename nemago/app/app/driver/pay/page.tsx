import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FeeTable } from "@/components/FeeTable";
import { PaymentBox } from "@/components/PaymentBox";
import { DISPATCH_FEE_DOLLARS, formatDollars } from "@/lib/fees";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Pay dispatch fee · NemaGo" };

export default async function DriverPay() {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");

  return (
    <AppShell>
      <Link href="/driver" className="back-link">
        ← Back
      </Link>
      <h1>Pay your dispatch fee</h1>
      <p className="muted">One flat fee to send a mechanic to you.</p>
      <PaymentBox
        title="Dispatch fee"
        amountText={formatDollars(DISPATCH_FEE_DOLLARS)}
        buttonText={"Pay " + formatDollars(DISPATCH_FEE_DOLLARS)}
        doneText="Test payment received."
      />
      <FeeTable />
    </AppShell>
  );
}
