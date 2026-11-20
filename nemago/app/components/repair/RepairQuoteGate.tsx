"use client";

import { useState } from "react";
import { PartsTrustBadge } from "@/components/booking/PartsTrustBadge";
import { DemoPhoto } from "@/components/repair/DemoPhoto";
import { RepairBreakdown } from "@/components/repair/RepairBreakdown";
import { friendlyError, postJson } from "@/lib/dispatch";
import { formatCents } from "@/lib/fees";
import { formatRepairWhen } from "@/lib/repair";
import { createClient } from "@/lib/supabase/client";
import type { RepairQuote } from "@/lib/useRepairQuote";

// The Secondary Approval Gate, as the driver sees it: the mechanic's repair quote with
// photo proof, a plain-English summary, the proposed date and time, and the math.
// "Approve & Pay Balance" goes to Stripe Checkout for the balance; "Decline Repair"
// closes the job (the mechanic keeps the 90% of the $80 they were paid on arrival).
export function RepairQuoteGate({
  quote,
  mechanicName,
  checkout,
  onChanged,
}: {
  quote: RepairQuote;
  mechanicName: string | null;
  checkout?: string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"" | "approve" | "decline">("");
  const [message, setMessage] = useState("");
  const name = mechanicName ?? "Your mechanic";

  async function approve() {
    setBusy("approve");
    setMessage("");
    const { ok, data } = await postJson("/api/repair/approve", { requestId: quote.request_id });
    if (ok && typeof data.url === "string") {
      window.location.assign(data.url);
      return;
    }
    setMessage(data.error === "stripe_failed" ? "We couldn't open the payment page. Please try again." : friendlyError(data.error));
    await onChanged();
    setBusy("");
  }

  async function decline() {
    if (
      !window.confirm(
        `Decline this repair? The job will close. Your ${formatCents(quote.credit_cents)} diagnosis fee is not refunded, and you won't be charged for the repair.`,
      )
    ) {
      return;
    }
    setBusy("decline");
    setMessage("");
    const { error } = await createClient().rpc("decline_repair_quote", { p_request_id: quote.request_id });
    if (error) setMessage(friendlyError(error.message));
    await onChanged();
    setBusy("");
  }

  return (
    <section className="gate-card" aria-labelledby="gate-title">
      <span className="badge">Approval needed</span>
      <h3 id="gate-title" className="gate-title">
        {name} sent a repair quote
      </h3>
      <p className="muted small">
        Nothing is charged until you approve. Review the repair below, then approve or decline.
      </p>

      {checkout === "repair_success" && (
        <div className="notice notice-success">
          Thanks! We&rsquo;re confirming your payment with Stripe. This usually takes a few seconds.
        </div>
      )}
      {checkout === "repair_cancelled" && (
        <div className="notice notice-error">Your payment wasn&rsquo;t completed. You can try again or decline.</div>
      )}
      {message && <div className="notice notice-error">{message}</div>}

      <DemoPhoto id={quote.photo_id} />

      <h4 className="gate-sub">What&rsquo;s wrong</h4>
      <p>{quote.issue_summary}</p>
      <h4 className="gate-sub">The repair</h4>
      <p>{quote.repair_description}</p>

      <div className="gate-when">
        <strong>Proposed repair</strong>
        <span>{formatRepairWhen(quote.repair_date, quote.window_start)}</span>
      </div>

      <RepairBreakdown partsCents={quote.parts_cents} laborCents={quote.labor_cents} />
      <PartsTrustBadge />

      <button type="button" className="btn btn-primary" onClick={approve} disabled={busy !== ""}>
        {busy === "approve" ? "Taking you to payment…" : `Approve & Pay Balance · ${formatCents(quote.net_due_cents)}`}
      </button>
      <button type="button" className="btn btn-google" onClick={decline} disabled={busy !== ""}>
        {busy === "decline" ? "Closing…" : "Decline Repair"}
      </button>
      <p className="muted small">
        If you decline, the job closes and your mechanic keeps their share of the {formatCents(quote.credit_cents)}{" "}
        diagnosis fee.
      </p>
    </section>
  );
}

// After the driver has paid: the repair is scheduled.
export function RepairScheduled({ quote, mechanicName }: { quote: RepairQuote; mechanicName: string | null }) {
  return (
    <section className="gate-card gate-done" aria-live="polite">
      <span className="badge badge-success">Repair approved</span>
      <h3 className="gate-title">Your repair is scheduled</h3>
      <div className="gate-when">
        <strong>{mechanicName ?? "Your mechanic"} will arrive</strong>
        <span>{formatRepairWhen(quote.repair_date, quote.window_start)}</span>
      </div>
      <p className="small">
        <strong>{quote.issue_summary}</strong>
      </p>
      <p className="muted small">
        You paid the {formatCents(quote.net_due_cents)} balance. Because the repair is paid for and scheduled, it can no
        longer be cancelled here. Your mechanic marks it complete when the work is done.
      </p>
    </section>
  );
}

// What happened to the quote, shown after the job is closed.
export function RepairOutcomeNote({ quote }: { quote: RepairQuote }) {
  if (quote.status === "completed") {
    return (
      <div className="notice notice-success">
        Your repair ({quote.issue_summary}) was completed. You paid {formatCents(quote.net_due_cents)} for the repair
        balance, on top of your diagnosis fee.
      </div>
    );
  }
  if (quote.status === "declined") {
    return (
      <div className="notice notice-success">
        You declined the repair, so the job was closed. You weren&rsquo;t charged for the repair.
      </div>
    );
  }
  return null;
}
