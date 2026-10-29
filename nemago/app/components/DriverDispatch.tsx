"use client";

import { useState } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { createClient } from "@/lib/supabase/client";
import { WAIT_SECONDS, contactOf, friendlyError, secondsSince } from "@/lib/dispatch";
import { useDispatchFeed, useNow } from "@/lib/useDispatchFeed";

// The driver's screen: ask for a mechanic, then watch the request update live.
export function DriverDispatch() {
  const { requests, loaded, failed, live, reload } = useDispatchFeed();
  const now = useNow();

  const [problem, setProblem] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // A driver can only have one request in progress at a time.
  const active = requests.find((r) => r.status === "open" || r.status === "accepted");
  const lastCancelled = !active && requests[0]?.status === "cancelled";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await createClient().rpc("request_dispatch", {
      p_problem: problem,
      p_area: area,
      p_address: address,
    });
    if (error) {
      setMessage(friendlyError(error.message));
    } else {
      setProblem("");
      await reload();
    }
    setBusy(false);
  }

  async function cancel(id: string) {
    setBusy(true);
    setMessage("");
    const { error } = await createClient().rpc("cancel_dispatch", { p_request_id: id });
    if (error) setMessage(friendlyError(error.message));
    await reload();
    setBusy(false);
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  if (failed && requests.length === 0) {
    return (
      <div className="notice notice-error">
        We couldn&rsquo;t load your requests. Please refresh the page. (If this keeps happening, the
        database setup for dispatch may not be finished.)
      </div>
    );
  }

  return (
    <div>
      <LiveStatus live={live} />
      {message && <div className="notice notice-error">{message}</div>}

      {!active && (
        <form className="card form" onSubmit={send}>
          {lastCancelled && <div className="notice notice-success">Your last request was cancelled.</div>}
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
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Request a mechanic"}
          </button>
        </form>
      )}

      {active?.status === "open" && (
        <div className="card">
          <span className="badge">Looking for a mechanic</span>
          <h2 className="pay-title">Your request has been sent</h2>
          <p className="muted">
            Verified mechanics can see it right now. This page updates the moment one accepts.
          </p>
          <p className="small">
            <strong>Problem:</strong> {active.problem}
            <br />
            <strong>Area:</strong> {active.area}
          </p>
          {secondsSince(active.created_at, now) > WAIT_SECONDS && (
            <div className="notice notice-error">
              No mechanic has accepted yet. You can keep waiting, or cancel and call a local shop or
              roadside service. If you feel unsafe, move away from traffic and call 911.
            </div>
          )}
          <button type="button" className="btn btn-google" onClick={() => cancel(active.id)} disabled={busy}>
            Cancel request
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
          </p>
          <button type="button" className="btn btn-google" onClick={() => cancel(active.id)} disabled={busy}>
            I no longer need help
          </button>
        </div>
      )}
    </div>
  );
}
