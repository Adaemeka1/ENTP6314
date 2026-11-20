"use client";

import { useState } from "react";
import { BookingChooser } from "@/components/booking/BookingChooser";
import { CheckoutSummary, linesFromTransaction } from "@/components/booking/CheckoutSummary";
import { ReceiptDetails, bookingTitle } from "@/components/booking/ReceiptDetails";
import { LiveStatus } from "@/components/LiveStatus";
import { MatchPanel } from "@/components/MatchPanel";
import { RateTipCard } from "@/components/RateTipCard";
import { RepairOutcomeNote, RepairQuoteGate, RepairScheduled } from "@/components/repair/RepairQuoteGate";
import { JobTracker } from "@/components/tracking/JobTracker";
import {
  WAIT_SECONDS,
  contactOf,
  friendlyError,
  postJson,
  secondsSince,
  transactionOf,
  vehicleLabel,
} from "@/lib/dispatch";
import { formatCents } from "@/lib/fees";
import { useDispatchFeed, useNow } from "@/lib/useDispatchFeed";
import { useRepairQuote } from "@/lib/useRepairQuote";

// The driver's screen: choose how to book, then watch the job update live.
// (Booking and paying happen on the two booking screens; this shows everything after.)
export function DriverDispatch({ checkout }: { checkout?: string }) {
  const { requests, loaded, failed, live, reload } = useDispatchFeed();
  const now = useNow();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // A driver can only have one request in progress at a time.
  const active = requests.find(
    (r) =>
      r.status === "awaiting_payment" ||
      r.status === "open" ||
      r.status === "accepted" ||
      r.status === "arrived" ||
      r.status === "diagnosed",
  );
  const last = active ? undefined : requests[0];

  // The repair quote (Secondary Approval Gate): while the mechanic has diagnosed the car,
  // and for the note about how a finished job ended.
  const quoteFor = active?.status === "diagnosed" ? active.id : last?.status === "completed" ? last.id : null;
  const { quote, reload: reloadQuote } = useRepairQuote(quoteFor);

  // Sends the driver back to Stripe's secure page for an unpaid booking.
  async function continuePayment(id: string) {
    setBusy(true);
    setMessage("");
    const { ok, data } = await postJson("/api/checkout", { requestId: id });
    if (ok && typeof data.url === "string") {
      window.location.assign(data.url);
      return;
    }
    setMessage(friendlyError(data.error));
    await reload();
    setBusy(false);
  }

  async function cancel(id: string, nonRefundable = false) {
    if (
      nonRefundable &&
      !window.confirm("Your mechanic has already arrived, so cancelling now is NOT refunded. Cancel anyway?")
    ) {
      return;
    }
    setBusy(true);
    setMessage("");
    const { ok, data } = await postJson("/api/dispatch/cancel", { requestId: id });
    if (!ok) setMessage(friendlyError(data.error));
    await reload();
    setBusy(false);
  }

  // The error screen is also what a driver sees if booking.sql hasn't been run.
  if (!loaded) return <p className="muted">Loading…</p>;
  if (failed && requests.length === 0) {
    return (
      <div className="notice notice-error">
        We couldn&rsquo;t load your requests. Please refresh the page. (If this keeps happening, the database
        setup for bookings may not be finished.)
      </div>
    );
  }

  const vehicle = active ? vehicleLabel(active) : "";
  const tx = active ? transactionOf(active) : null;
  const paid = active && active.price_cents !== null ? formatCents(active.price_cents) : "";

  return (
    <div>
      <LiveStatus live={live} />
      {message && <div className="notice notice-error">{message}</div>}

      {checkout === "cancelled" && active?.status === "awaiting_payment" && (
        <div className="notice notice-error">
          Your payment wasn&rsquo;t completed. You can try again or cancel the request.
        </div>
      )}
      {checkout === "success" && active?.status === "awaiting_payment" && (
        <div className="notice notice-success">
          Thanks! We&rsquo;re confirming your payment with Stripe. This usually takes a few seconds.
        </div>
      )}

      {!active && (
        <>
          {last?.status === "completed" && (
            <div className="notice notice-success">
              Your last job ({bookingTitle(last)}) was completed.{" "}
              {last.price_cents !== null && <>{formatCents(last.price_cents)} was charged. </>}Thank you!
            </div>
          )}
          {last?.status === "cancelled" && last.refund_status === "refunded" && (
            <div className="notice notice-success">
              Your last request was cancelled and refunded in full. Your bank can take 5 to 10 days to show it.
            </div>
          )}
          {last?.status === "cancelled" &&
            (last.refund_status === "pending" || last.refund_status === "failed") && (
              <div className="notice notice-error">
                Your last request was cancelled, but your refund hasn&rsquo;t gone through yet.
                <button type="button" className="btn btn-google" onClick={() => cancel(last.id)} disabled={busy}>
                  Retry refund
                </button>
              </div>
            )}
          {last?.status === "cancelled" && last.refund_status === "none" && last.arrived_at && (
            <div className="notice notice-success">
              Your last request was cancelled after your mechanic arrived, so it wasn&rsquo;t refunded.
            </div>
          )}
          {last?.status === "cancelled" && last.refund_status === "none" && !last.arrived_at && !last.diagnosis && (
            <div className="notice notice-success">Your last request was cancelled.</div>
          )}
          {last?.status === "completed" && quote && <RepairOutcomeNote quote={quote} />}
          {last?.status === "completed" && (
            <RateTipCard requestId={last.id} mechanicName={last.mechanic_first_name} checkout={checkout} />
          )}
          <BookingChooser />
        </>
      )}

      {active?.status === "awaiting_payment" && (
        <div className="card">
          <span className="badge">Payment needed</span>
          <h2 className="pay-title">Finish paying to send your request</h2>
          <p className="muted">Mechanics will see your request as soon as your payment goes through.</p>
          <p className="small">
            <strong>Booking:</strong> {bookingTitle(active)}
            {vehicle && (
              <>
                <br />
                <strong>Vehicle:</strong> {vehicle}
              </>
            )}
            <br />
            <strong>Area:</strong> {active.area}
          </p>
          {tx && active.price_cents !== null && (
            <CheckoutSummary lines={linesFromTransaction(tx, active.booking_type)} totalCents={active.price_cents} />
          )}
          <button type="button" className="btn btn-primary" onClick={() => continuePayment(active.id)} disabled={busy}>
            {busy ? "Taking you to payment…" : "Continue to payment" + (paid ? " · " + paid : "")}
          </button>
          <button type="button" className="btn btn-google" onClick={() => cancel(active.id)} disabled={busy}>
            Cancel request
          </button>
        </div>
      )}

      {active?.status === "open" && (
        <div className="card">
          <span className="badge">Looking for a mechanic</span>
          <h2 className="pay-title">Payment received. Your request has been sent</h2>
          <p className="muted">Verified mechanics can see it right now. This page updates the moment one accepts.</p>
          <p className="small">
            <strong>Booking:</strong> {bookingTitle(active)}
            {vehicle && (
              <>
                <br />
                <strong>Vehicle:</strong> {vehicle}
              </>
            )}
            <br />
            <strong>Area:</strong> {active.area}
            <br />
            <strong>Paid:</strong> {paid}
          </p>
          <ReceiptDetails request={active} />
          <MatchPanel requestId={active.id} status={active.status} etaMinutes={active.eta_minutes} />
          {secondsSince(active.opened_at ?? active.created_at, now) > WAIT_SECONDS && (
            <div className="notice notice-error">
              No mechanic has accepted yet. You can keep waiting, or cancel for a full refund and call a local shop
              or roadside service. If you feel unsafe, move away from traffic and call 911.
            </div>
          )}
          <button type="button" className="btn btn-google" onClick={() => cancel(active.id)} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel and get a full refund"}
          </button>
        </div>
      )}

      {active?.status === "accepted" && (
        <div className="card job-matched">
          <span className="badge badge-success">You&rsquo;re matched!</span>
          <h2 className="pay-title">{active.mechanic_first_name ?? "A mechanic"} is on the way</h2>
          <JobTracker
            requestId={active.id}
            status={active.status}
            acceptedAt={active.accepted_at}
            fallbackIso={active.opened_at ?? active.created_at}
            etaMinutes={active.eta_minutes}
            mechanicName={active.mechanic_first_name}
            vehicle={vehicle}
          />
          <p className="small">
            <strong>Booking:</strong> {bookingTitle(active)}
            {vehicle && (
              <>
                <br />
                <strong>Vehicle:</strong> {vehicle}
              </>
            )}
            <br />
            <strong>Meeting you at:</strong> {contactOf(active)?.address}
            <br />
            <strong>Paid:</strong> {paid}
          </p>
          <ReceiptDetails request={active} />
          <MatchPanel requestId={active.id} status={active.status} etaMinutes={active.eta_minutes} />
          <p className="muted small">You can cancel for a full refund until your mechanic arrives.</p>
          <button type="button" className="btn btn-google" onClick={() => cancel(active.id)} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel and get a full refund"}
          </button>
        </div>
      )}

      {(active?.status === "arrived" || active?.status === "diagnosed") && (
        <div className="card job-matched">
          <span className="badge badge-success">
            {active.status === "diagnosed" ? "Diagnosis recorded" : "Your mechanic has arrived"}
          </span>
          <h2 className="pay-title">
            {active.mechanic_first_name ?? "Your mechanic"}{" "}
            {active.status === "diagnosed" ? "found the problem" : "is with your car"}
          </h2>
          <JobTracker
            requestId={active.id}
            status={active.status}
            acceptedAt={active.accepted_at}
            fallbackIso={active.opened_at ?? active.created_at}
            etaMinutes={active.eta_minutes}
            mechanicName={active.mechanic_first_name}
            vehicle={vehicle}
          />
          {active.diagnosis && <p className="diagnosis-text">{active.diagnosis}</p>}
          {quote?.status === "sent" && active.status === "diagnosed" && (
            <RepairQuoteGate
              quote={quote}
              mechanicName={active.mechanic_first_name}
              checkout={checkout}
              onChanged={async () => {
                await Promise.all([reloadQuote(), reload()]);
              }}
            />
          )}
          {quote?.status === "paid" && <RepairScheduled quote={quote} mechanicName={active.mechanic_first_name} />}
          <p className="small">
            <strong>Booking:</strong> {bookingTitle(active)}
            {vehicle && (
              <>
                <br />
                <strong>Vehicle:</strong> {vehicle}
              </>
            )}
            <br />
            <strong>Paid:</strong> {paid}
          </p>
          <ReceiptDetails request={active} />
          <p className="muted small">
            Your mechanic is on site, so this payment is no longer refundable, whether the job is completed or
            cancelled.
          </p>
          {quote?.status !== "paid" && (
            <button type="button" className="btn btn-google" onClick={() => cancel(active.id, true)} disabled={busy}>
              {busy ? "Cancelling…" : "Cancel (no refund)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
