"use client";

import { useEffect, useRef, useState } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { createClient } from "@/lib/supabase/client";
import { ETA_CHOICES, contactOf, friendlyError, timeAgo } from "@/lib/dispatch";
import { useDispatchFeed, useNow } from "@/lib/useDispatchFeed";

// The mechanic's screen: new job requests pop up live, and one tap accepts.
export function MechanicJobs() {
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

  if (!loaded) return <p className="muted">Loading…</p>;

  if (failed && requests.length === 0) {
    return (
      <div className="notice notice-error">
        We couldn&rsquo;t load job requests. Please refresh the page. (If this keeps happening, the
        database setup for dispatch may not be finished.)
      </div>
    );
  }

  return (
    <div>
      <LiveStatus live={live} />

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
            {r.area} · {timeAgo(r.created_at, now)}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => accept(r.id)}
            disabled={busyId !== ""}
          >
            {busyId === r.id ? "Accepting…" : "Accept this job"}
          </button>
        </div>
      ))}

      {mine.length > 0 && <h2 className="section-title">Your jobs</h2>}
      {mine.map((r) =>
        r.status === "accepted" ? (
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
            </p>
          </div>
        ) : (
          <div key={r.id} className="card">
            <span className="badge">Cancelled by the driver</span>
            <p className="muted small">{r.area}. No action needed.</p>
          </div>
        ),
      )}
    </div>
  );
}
