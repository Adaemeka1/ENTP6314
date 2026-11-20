"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PartsPickupCard } from "@/components/booking/PartsPickupCard";
import { bookingTitle } from "@/components/booking/ReceiptDetails";
import { LiveStatus } from "@/components/LiveStatus";
import { MatchBreakdown } from "@/components/MatchBreakdown";
import { DiagnosedJobCard, RepairPayoutNote } from "@/components/repair/MechanicRepair";
import { createClient } from "@/lib/supabase/client";
import {
  ETA_CHOICES,
  contactOf,
  friendlyError,
  postJson,
  timeAgo,
  transactionOf,
  vehicleLabel,
  type DispatchRequest,
} from "@/lib/dispatch";
import { DIAGNOSTIC_FEE_LABEL, DISPATCH_FEE_LABEL, formatCents, mechanicShareCents } from "@/lib/fees";
import { MECHANIC_PERCENT } from "@/lib/pricing";
import { toPublic, scoreMechanic, type Candidate } from "@/lib/match";
import { useDispatchFeed, useNow } from "@/lib/useDispatchFeed";

// What the mechanic receives for a job, e.g. "$72.00". Empty if the price isn't known.
function earnings(r: DispatchRequest) {
  const tx = transactionOf(r);
  if (tx) return formatCents(tx.mechanic_payout_cents);
  if (r.price_cents === null || r.platform_fee_cents === null) return null;
  return formatCents(mechanicShareCents(r.price_cents, r.platform_fee_cents));
}

// "Dispatch fee $35.00 (NemaGo) · Parts $85.00 (NemaGo, pre-paid) · Labor $90.00 (you get 90%)"
function breakdown(r: DispatchRequest) {
  const tx = transactionOf(r);
  if (!tx) return null;
  const labor = r.booking_type === "diagnosis" ? DIAGNOSTIC_FEE_LABEL : "Labor";
  return (
    `${DISPATCH_FEE_LABEL} ${formatCents(tx.dispatch_fee_cents)} (NemaGo)` +
    (tx.parts_total_cents > 0 ? ` · Parts ${formatCents(tx.parts_total_cents)} (NemaGo, pre-paid)` : "") +
    ` · ${labor} ${formatCents(tx.labor_and_diag_total_cents)} (you get ${MECHANIC_PERCENT}%)`
  );
}

// The "diagnostic entry": the mechanic writes down what they found. After this
// the job can be completed, and the driver can no longer get a refund.
function DiagnosisForm({
  requestId,
  disabled,
  onSaved,
  onError,
}: {
  requestId: string;
  disabled: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        "Record this only after you have diagnosed the car. Continue?",
      )
    ) {
      return;
    }
    setSaving(true);
    const { error } = await createClient().rpc("record_diagnosis", {
      p_request_id: requestId,
      p_diagnosis: text,
    });
    if (error) onError(friendlyError(error.message));
    await onSaved();
    setSaving(false);
  }

  return (
    <form className="form" onSubmit={save}>
      <label>
        Diagnostic entry: what did you find?
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="For example: cracked upper radiator hose leaking coolant"
          minLength={3}
          maxLength={1000}
          rows={3}
          required
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={disabled || saving}>
        {saving ? "Saving…" : "Record diagnosis"}
      </button>
    </form>
  );
}

// The mechanic's screen: new paid requests pop up live, one tap accepts, they
// record a diagnosis on site, and finishing the job pays them.
export function MechanicJobs({ payoutsEnabled, me }: { payoutsEnabled: boolean; me: Candidate }) {
  const { requests, loaded, failed, live, reload } = useDispatchFeed();
  const now = useNow();

  const [eta, setEta] = useState(20);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  // Smart Dispatch Match: how well THIS mechanic fits each open job. Best fit first.
  const open = requests
    .filter((r) => r.status === "open")
    .map((r) => ({ r, match: scoreMechanic(me, r.problem, r.id) }))
    .sort((a, b) => b.match.score - a.match.score)
    .map(({ r }) => r);
  const matchFor = (r: DispatchRequest) => toPublic(scoreMechanic(me, r.problem, r.id));
  const mine = requests.filter((r) => r.status !== "open").slice(0, 5);

  // Notice requests that appear after the screen first loaded, and flash an alert.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    if (!loaded) return;
    const ids = open.map((r) => r.id);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !seen.current!.has(id));
    if (added.length === 0) return;
    added.forEach((id) => seen.current!.add(id));
    setFresh((old) => [...old, ...added]);
    setTimeout(() => setFresh((old) => old.filter((id) => !added.includes(id))), 15000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, loaded]);

  async function accept(id: string) {
    setBusyId(id);
    setMessage("");
    const { error } = await createClient().rpc("accept_dispatch", {
      p_request_id: id,
      p_eta_minutes: eta,
    });
    if (error) setMessage(friendlyError(error.message));
    await reload();
    setBusyId("");
  }

  // Marks the job complete and pays the mechanic. Safe to tap again if a payout failed.
  async function complete(id: string) {
    setBusyId(id);
    setMessage("");
    const { ok, data } = await postJson("/api/dispatch/complete", { requestId: id });
    if (!ok) setMessage(friendlyError(data.error));
    await reload();
    setBusyId("");
  }

  // "I've arrived": from here the driver can no longer get a refund. On a diagnosis
  // job the mechanic's 90% of the diagnosis fee is paid now. Safe to tap again if a payout failed.
  async function arrive(r: DispatchRequest) {
    if (
      r.status === "accepted" &&
      !window.confirm("Tap this only when you are with the car. The driver can no longer get a refund after this. Continue?")
    ) {
      return;
    }
    setBusyId(r.id);
    setMessage("");
    const { ok, data } = await postJson("/api/dispatch/arrive", { requestId: r.id });
    if (!ok) setMessage(friendlyError(data.error));
    await reload();
    setBusyId("");
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  if (failed && requests.length === 0) {
    return (
      <div className="notice notice-error">
        We couldn&rsquo;t load job requests. Please refresh the page. (If this keeps happening, the
        database setup for dispatch or payments may not be finished.)
      </div>
    );
  }

  return (
    <div>
      <LiveStatus live={live} />

      {!payoutsEnabled && (
        <div className="notice notice-error">
          You need to set up payouts before you can accept jobs.{" "}
          <Link href="/mechanic/payouts">Set Up Payouts</Link>
        </div>
      )}
      {open.some((r) => fresh.includes(r.id)) && (
        <div className="alert-banner" role="alert">
          New job request just came in!
        </div>
      )}
      {message && <div className="notice notice-error">{message}</div>}

      <label className="eta-pick">
        When you accept, tell the driver you&rsquo;ll arrive in
        <select value={eta} onChange={(e) => setEta(Number(e.target.value))}>
          {ETA_CHOICES.map((m) => (
            <option key={m} value={m}>
              about {m} minutes
            </option>
          ))}
        </select>
      </label>

      <h2 className="section-title">Open requests</h2>
      {open.length === 0 && <p className="muted">No open requests right now. New ones appear here by themselves.</p>}
      {open.map((r) => (
        <div key={r.id} className={fresh.includes(r.id) ? "card job-card job-new" : "card job-card"}>
          {fresh.includes(r.id) && <span className="badge badge-new">New</span>}
          <strong>{bookingTitle(r)}</strong>
          {vehicleLabel(r) && <p className="small">{vehicleLabel(r)}</p>}
          <p className="muted small">
            {r.area} · {timeAgo(r.opened_at ?? r.created_at, now)}
          </p>
          {r.problem && r.booking_type === "diagnosis" && <p className="small">{r.problem}</p>}
          {earnings(r) && (
            <p className="small">
              <strong>You receive {earnings(r)}</strong>{" "}
              {r.booking_type === "diagnosis"
                ? "(" + MECHANIC_PERCENT + "% of the " + DIAGNOSTIC_FEE_LABEL + ") when you arrive."
                : "(" + MECHANIC_PERCENT + "% of the labor) when you complete the job."}{" "}
              {r.booking_type === "fixed_price" && "Parts are bought and pre-paid by NemaGo."}
            </p>
          )}
          <MatchBreakdown match={matchFor(r)} intro="Why this job fits you" />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => accept(r.id)}
            disabled={busyId !== "" || !payoutsEnabled}
          >
            {busyId === r.id ? "Accepting…" : "Accept this job"}
          </button>
        </div>
      ))}

      {mine.length > 0 && <h2 className="section-title">Your jobs</h2>}
      {mine.map((r) => {
        if (r.status === "accepted" || r.status === "arrived") {
          const arrived = r.status === "arrived";
          const isDiag = r.booking_type === "diagnosis";
          return (
            <div key={r.id} className="card job-matched">
              <span className="badge badge-success">{arrived ? "You've arrived" : "Assigned to you"}</span>
              <p>
                <strong>{contactOf(r)?.driver_first_name ?? "The driver"}</strong>
                {arrived ? " is with you." : " is expecting you in about " + r.eta_minutes + " minutes."}
              </p>
              <p className="small">
                <strong>Job:</strong> {bookingTitle(r)}
                {vehicleLabel(r) && (
                  <>
                    <br />
                    <strong>Vehicle:</strong> {vehicleLabel(r)}
                  </>
                )}
                {(contactOf(r)?.vehicle_vin || contactOf(r)?.vehicle_plate) && (
                  <>
                    <br />
                    <strong>{contactOf(r)?.vehicle_vin ? "VIN:" : "Plate:"}</strong>{" "}
                    {contactOf(r)?.vehicle_vin ?? contactOf(r)?.vehicle_plate}
                  </>
                )}
                <br />
                <strong>Go to:</strong> {contactOf(r)?.address}
                {r.problem && isDiag && (
                  <>
                    <br />
                    <strong>Problem:</strong> {r.problem}
                  </>
                )}
                {breakdown(r) && (
                  <>
                    <br />
                    <strong>Pay:</strong> {breakdown(r)}
                  </>
                )}
              </p>
              <PartsPickupCard request={r} />
              {!arrived && (
                <>
                  <p className="muted small">
                    The driver can still cancel for a full refund until you tap &ldquo;I&rsquo;ve arrived&rdquo;.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => arrive(r)}
                    disabled={busyId !== ""}
                  >
                    {busyId === r.id ? "Saving…" : "I've arrived"}
                  </button>
                </>
              )}
              {arrived && isDiag && (
                <>
                  {r.payout_status === "paid_out" && (
                    <p className="small">
                      <strong>{earnings(r)}</strong> was sent to your Stripe account when you arrived.
                    </p>
                  )}
                  {r.payout_status === "failed" && (
                    <>
                      <p className="small">Your arrival payout hit a problem.</p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => arrive(r)}
                        disabled={busyId !== ""}
                      >
                        {busyId === r.id ? "Trying…" : "Try payout again"}
                      </button>
                    </>
                  )}
                  <DiagnosisForm
                    requestId={r.id}
                    disabled={busyId !== ""}
                    onSaved={reload}
                    onError={setMessage}
                  />
                </>
              )}
              {arrived && !isDiag && (
                <>
                  <p className="muted small">
                    Finish the service, then mark it complete. You&rsquo;re paid {earnings(r)} when you do.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => complete(r.id)}
                    disabled={busyId !== ""}
                  >
                    {busyId === r.id ? "Completing…" : "Mark job complete"}
                  </button>
                </>
              )}
            </div>
          );
        }
        if (r.status === "diagnosed") {
          return (
            <DiagnosedJobCard
              key={r.id}
              request={r}
              earningsText={earnings(r)}
              busy={busyId !== ""}
              onCompleteJob={complete}
              onReload={reload}
              onMessage={setMessage}
            />
          );
        }
        if (r.status === "completed" || (r.status === "cancelled" && r.arrived_at)) {
          const cancelled = r.status === "cancelled";
          return (
            <div key={r.id} className="card">
              <span className={cancelled ? "badge" : "badge badge-success"}>
                {cancelled ? "Cancelled by the driver after you arrived" : "Completed"}
              </span>
              {cancelled && (
                <p className="muted small">
                  The driver cancelled after you arrived, so the payment is not refunded and you&rsquo;re still
                  paid your {MECHANIC_PERCENT}%.
                </p>
              )}
              {r.payout_status === "paid_out" && (
                <p className="small">
                  <strong>{earnings(r)}</strong> was sent to your Stripe account. Stripe pays it to your
                  bank on its normal schedule.
                </p>
              )}
              {r.payout_status === "pending" && <p className="small">Sending your payout…</p>}
              {r.payout_status === "failed" && (
                <>
                  <p className="small">
                    The payout hit a problem. {cancelled ? "" : "Your job is still marked complete."}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => complete(r.id)}
                    disabled={busyId !== ""}
                  >
                    {busyId === r.id ? "Trying…" : "Try payout again"}
                  </button>
                </>
              )}
              {!cancelled && <RepairPayoutNote requestId={r.id} onReload={reload} onMessage={setMessage} />}
            </div>
          );
        }
        return (
          <div key={r.id} className="card">
            <span className="badge">Cancelled by the driver</span>
            <p className="muted small">{r.area}. They cancelled before you arrived, so nothing is owed.</p>
          </div>
        );
      })}
    </div>
  );
}
