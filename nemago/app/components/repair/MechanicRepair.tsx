"use client";

import { useState } from "react";
import { PartsPickupCard } from "@/components/booking/PartsPickupCard";
import { RepairQuoteForm } from "@/components/repair/RepairQuoteForm";
import { contactOf, friendlyError, postJson, type DispatchRequest } from "@/lib/dispatch";
import { formatCents } from "@/lib/fees";
import { MECHANIC_PERCENT, mechanicPayoutCents } from "@/lib/pricing";
import { formatRepairWhen } from "@/lib/repair";
import { useRepairQuote, type RepairQuote } from "@/lib/useRepairQuote";

// Marks an approved repair as done and pays the mechanic. Safe to tap again if a payout failed.
async function completeRepair(requestId: string) {
  const { ok, data } = await postJson("/api/repair/complete", { requestId });
  return {
    ok,
    message: ok
      ? ""
      : data.error === "payout_failed"
        ? "The repair is marked complete, but the payout hit a problem. Tap “Try payout again”."
        : friendlyError(data.error),
  };
}

// The mechanic's card for a diagnosis job after they recorded the diagnosis. This is where
// they send the repair quote, wait for the driver, and (once it is paid) finish the repair.
export function DiagnosedJobCard({
  request: r,
  earningsText,
  busy,
  onCompleteJob,
  onReload,
  onMessage,
}: {
  request: DispatchRequest;
  earningsText: string | null;
  busy: boolean;
  onCompleteJob: (id: string) => void;
  onReload: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const { quote, reload, loaded, unavailable } = useRepairQuote(r.id);
  const [finishing, setFinishing] = useState(false);

  async function refresh() {
    await Promise.all([reload(), onReload()]);
  }

  async function finishRepair() {
    setFinishing(true);
    onMessage("");
    const { message } = await completeRepair(r.id);
    if (message) onMessage(message);
    await refresh();
    setFinishing(false);
  }

  const paid = quote?.status === "paid";
  return (
    <div className="card job-matched">
      <span className="badge badge-success">Diagnosis recorded</span>
      <p className="diagnosis-text">{r.diagnosis}</p>
      <p className="small">
        <strong>Go to:</strong> {contactOf(r)?.address}
      </p>
      <p className="muted small">
        Your {earningsText} {r.payout_status === "paid_out" ? "was already paid when you arrived." : "is paid as soon as your arrival payout goes through."}
      </p>

      {loaded && !unavailable && !quote && (
        <RepairQuoteForm requestId={r.id} disabled={busy} onSent={refresh} onError={onMessage} />
      )}

      {quote?.status === "sent" && <QuoteSentSummary quote={quote} />}
      {paid && quote && (
        <>
          <div className="gate-card gate-done">
            <span className="badge badge-success">Repair approved and paid</span>
            <h3 className="gate-title">Repair scheduled</h3>
            <div className="gate-when">
              <strong>{contactOf(r)?.driver_first_name ?? "The driver"} expects you</strong>
              <span>{formatRepairWhen(quote.repair_date, quote.window_start)}</span>
            </div>
            <p className="small">
              <strong>{quote.issue_summary}</strong>
            </p>
            <p className="small">
              <strong>You receive {formatCents(quote.mechanic_payout_cents)}</strong> when you mark the repair complete (
              {MECHANIC_PERCENT}% of labor beyond the diagnosis fee).
            </p>
          </div>
          <PartsPickupCard request={r} />
          <button type="button" className="btn btn-primary" onClick={finishRepair} disabled={busy || finishing}>
            {finishing ? "Completing…" : "Mark repair complete"}
          </button>
        </>
      )}

      {!paid && (
        <>
          <p className="muted small">
            {quote?.status === "sent"
              ? "Marking the job complete instead withdraws your quote."
              : "No repair needed? Mark the visit complete once you are done."}
          </p>
          <button
            type="button"
            className={quote ? "btn btn-google" : "btn btn-primary"}
            onClick={() => onCompleteJob(r.id)}
            disabled={busy || finishing}
          >
            {busy ? "Completing…" : "Mark job complete"}
          </button>
        </>
      )}
    </div>
  );
}

function QuoteSentSummary({ quote }: { quote: RepairQuote }) {
  return (
    <div className="gate-card">
      <span className="badge">Quote sent</span>
      <h3 className="gate-title">Waiting for the driver</h3>
      <p className="small">
        <strong>{quote.issue_summary}</strong>
        <br />
        {formatRepairWhen(quote.repair_date, quote.window_start)}
        <br />
        Balance due from the driver: <strong>{formatCents(quote.net_due_cents)}</strong>
      </p>
      <p className="muted small">
        This updates by itself when they approve and pay, or decline. If they approve, you&rsquo;ll see the repair
        scheduled here.
      </p>
    </div>
  );
}

// On a closed job: how the repair ended, and a retry if the repair payout failed.
export function RepairPayoutNote({
  requestId,
  onReload,
  onMessage,
}: {
  requestId: string;
  onReload: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const { quote, reload } = useRepairQuote(requestId, false);
  const [busy, setBusy] = useState(false);
  if (!quote || (quote.status !== "completed" && quote.status !== "declined")) return null;

  if (quote.status === "declined") {
    return (
      <p className="muted small">
        The driver declined the repair. You keep the {formatCents(mechanicPayoutCents(quote.credit_cents))} you were paid on arrival.
      </p>
    );
  }

  async function retry() {
    setBusy(true);
    onMessage("");
    const { message } = await completeRepair(requestId);
    if (message) onMessage(message);
    await Promise.all([reload(), onReload()]);
    setBusy(false);
  }

  return (
    <div className="repair-payout">
      <p className="small">
        <strong>Repair completed.</strong>{" "}
        {quote.payout_status === "paid_out" && `${formatCents(quote.mechanic_payout_cents)} was sent to your Stripe account for the repair.`}
        {quote.payout_status === "pending" && "Sending your repair payout…"}
        {quote.payout_status === "failed" && "Your repair payout hit a problem."}
      </p>
      {quote.payout_status === "failed" && (
        <button type="button" className="btn btn-primary" onClick={retry} disabled={busy}>
          {busy ? "Trying…" : "Try payout again"}
        </button>
      )}
    </div>
  );
}
