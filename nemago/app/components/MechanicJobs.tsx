"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { createClient } from "@/lib/supabase/client";
import {
  ETA_CHOICES,
  contactOf,
  friendlyError,
  postJson,
  timeAgo,
  type DispatchRequest,
} from "@/lib/dispatch";
import { formatCents, mechanicShareCents } from "@/lib/fees";
import { useDispatchFeed, useNow } from "@/lib/useDispatchFeed";

// What the mechanic will be paid for a job, e.g. "$91.37". Empty if the price isn't known.
function earnings(r: DispatchRequest) {
  if (r.price_cents === null || r.platform_fee_cents === null) return null;
  return formatCents(mechanicShareCents(r.price_cents, r.platform_fee_cents));
}

// The mechanic's screen: new paid requests pop up live, one tap accepts, and
// finishing the job pays them.
export function MechanicJobs({ payoutsEnabled }: { payoutsEnabled: boolean }) {
  const { requests, loaded, failed, live, reload } = useDispatchFeed();
  const now = useNow();

  const [eta, setEta] = useState(20);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const open = requests.filter((r) => r.status === "open");
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
          <strong>{r.problem}</strong>
          <p className="muted small">
            {r.area} · {timeAgo(r.opened_at ?? r.created_at, now)}
            {earnings(r) && <> · You earn {earnings(r)}</>}
          </p>
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
        if (r.status === "accepted") {
          return (
            <div key={r.id} className="card job-matched">
              <span className="badge badge-success">Assigned to you</span>
              <p>
                <strong>{contactOf(r)?.driver_first_name ?? "The driver"}</strong> is expecting you in
                about {r.eta_minutes} minutes.
              </p>
              <p className="small">
                <strong>Problem:</strong> {r.problem}
                <br />
                <strong>Go to:</strong> {contactOf(r)?.address}
                {earnings(r) && (
                  <>
                    <br />
                    <strong>You&rsquo;ll be paid:</strong> {earnings(r)} when you mark it complete
                  </>
                )}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => complete(r.id)}
                disabled={busyId !== ""}
              >
                {busyId === r.id ? "Completing…" : "Mark job complete"}
              </button>
            </div>
          );
        }
        if (r.status === "completed") {
          return (
            <div key={r.id} className="card">
              <span className="badge badge-success">Completed</span>
              {r.payout_status === "paid_out" && (
                <p className="small">
                  <strong>{earnings(r)}</strong> was sent to your Stripe account. Stripe pays it to your
                  bank on its normal schedule.
                </p>
              )}
              {r.payout_status === "pending" && <p className="small">Sending your payout…</p>}
              {r.payout_status === "failed" && (
                <>
                  <p className="small">The payout hit a problem. Your job is still marked complete.</p>
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
            </div>
          );
        }
        return (
          <div key={r.id} className="card">
            <span className="badge">Cancelled by the driver</span>
            <p className="muted small">{r.area}. No action needed, and nothing is owed.</p>
          </div>
        );
      })}
    </div>
  );
}
