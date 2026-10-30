"use client";

import { useState } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { WAIT_SECONDS, contactOf, friendlyError, postJson, secondsSince } from "@/lib/dispatch";
import { SERVICE_PRICE_CENTS, formatCents } from "@/lib/fees";
import { useDispatchFeed, useNow } from "@/lib/useDispatchFeed";

// The driver's screen: confirm and pay for a dispatch, then watch it update live.
export function DriverDispatch({ checkout }: { checkout?: string }) {
  const { requests, loaded, failed, live, reload } = useDispatchFeed();
  const now = useNow();

  const [problem, setProblem] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // A driver can only have one request in progress at a time.
  const active = requests.find(
    (r) => r.status === "awaiting_payment" || r.status === "open" || r.status === "accepted",
  );
  const last = active ? undefined : requests[0];
  const price = formatCents(SERVICE_PRICE_CENTS);

  // Sends the driver to Stripe's secure payment page.
  async function goToPayment(body: object) {
    setBusy(true);
    setMessage("");
    const { ok, data } = await postJson("/api/checkout", body);
    if (ok && typeof data.url === "string") {
      window.location.assign(data.url);
      return;
    }
    setMessage(friendlyError(data.error));
    await reload();
    setBusy(false);
  }

  function confirmDispatch(e: React.FormEvent) {
    e.preventDefault();
    goToPayment({ problem, area, address });
  }

  async function cancel(id: string) {
    setBusy(true);
    setMessage("");
    const { ok, data } = await postJson("/api/dispatch/cancel", { requestId: id });
    if (!ok) setMessage(friendlyError(data.error));
    await reload();
    setBusy(false);
  }

  // The error screen is also what a driver sees if dispatch.sql or payments.sql hasn't been run.
  if (!loaded) return <p className="muted">Loading…</p>;
  if (failed && requests.length === 0) {
    return (
      <div className="notice notice-error">
        We couldn&rsquo;t load your requests. Please refresh the page. (If this keeps happening, the
        database setup for dispatch or payments may not be finished.)
      </div>
    );
  }

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
        <form className="card form" onSubmit={confirmDispatch}>
          {last?.status === "completed" && (
            <div className="notice notice-success">Your last job was completed. Thank you!</div>
          )}
          {last?.status === "cancelled" && last.refund_status === "refunded" && (
            <div className="notice notice-success">
              Your last request was cancelled and refunded in full. Your bank can take 5 to 10 days to
              show it.
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
          {last?.status === "cancelled" && last.refund_status === "none" && (
            <div className="notice notice-success">Your last request was cancelled.</div>
          )}

          <label>
            What&rsquo;s wrong?
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="For example: white smoke under the hood"
              minLength={3}
              maxLength={500}
              rows={3}
              required
            />
          </label>
          <label>
            Your general area
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="For example: Downtown Austin"
              minLength={2}
              maxLength={80}
              required
            />
            <small className="muted">Mechanics see this before they accept.</small>
          </label>
          <label>
            Where is your car?
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address or nearest cross streets"
              minLength={3}
              maxLength={200}
              required
            />
            <small className="muted">Only the mechanic who accepts your job will see this.</small>
          </label>

          <div className="price-box">
            <span>Roadside service</span>
            <strong>{price}</strong>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Taking you to payment…" : "Confirm Dispatch · " + price}
          </button>
          <small className="muted">
            You&rsquo;ll pay on Stripe&rsquo;s secure page. Full refund if you cancel before the job is
            done. Test mode: use card 4242 4242 4242 4242, any future date and any 3-digit code.
          </small>
        </form>
      )}

      {active?.status === "awaiting_payment" && (
        <div className="card">
          <span className="badge">Payment needed</span>
          <h2 className="pay-title">Finish paying to send your request</h2>
          <p className="muted">
            Mechanics will see your request as soon as your payment goes through.
          </p>
          <p className="small">
            <strong>Problem:</strong> {active.problem}
            <br />
            <strong>Area:</strong> {active.area}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => goToPayment({ requestId: active.id })}
            disabled={busy}
          >
            {busy ? "Taking you to payment…" : "Continue to payment · " + price}
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
          <p className="muted">
            Verified mechanics can see it right now. This page updates the moment one accepts.
          </p>
          <p className="small">
            <strong>Problem:</strong> {active.problem}
            <br />
            <strong>Area:</strong> {active.area}
            <br />
            <strong>Paid:</strong> {formatCents(active.price_cents ?? SERVICE_PRICE_CENTS)}
          </p>
          {secondsSince(active.opened_at ?? active.created_at, now) > WAIT_SECONDS && (
            <div className="notice notice-error">
              No mechanic has accepted yet. You can keep waiting, or cancel for a full refund and call a
              local shop or roadside service. If you feel unsafe, move away from traffic and call 911.
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
          <p className="muted">
            Estimated arrival: about <strong>{active.eta_minutes} minutes</strong> from when they
            accepted.
          </p>
          <p className="small">
            <strong>Problem:</strong> {active.problem}
            <br />
            <strong>Meeting you at:</strong> {contactOf(active)?.address}
            <br />
            <strong>Paid:</strong> {formatCents(active.price_cents ?? SERVICE_PRICE_CENTS)}
          </p>
          <button type="button" className="btn btn-google" onClick={() => cancel(active.id)} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel and get a full refund"}
          </button>
        </div>
      )}
    </div>
  );
}
