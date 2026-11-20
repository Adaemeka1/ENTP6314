"use client";

import { useEffect, useMemo, useState } from "react";
import { TrackingMap } from "@/components/tracking/TrackingMap";
import { postJson } from "@/lib/dispatch";
import { DEMO_ROUTES } from "@/lib/demoRoutes";
import { demoVan, fastDemoSpeed, hashOf, initialsOf, trackingState } from "@/lib/tracking";
import { useNow } from "@/lib/useDispatchFeed";

type MatchInfo = { ase: string | null; rating: number | null };

// Reads the ASE badge (real) and star rating (simulated) out of the match data the
// driver already gets from /api/match.
function readMatch(body: Record<string, unknown>): MatchInfo | null {
  const matches = body.matches as
    | Array<{ tags?: Array<{ text: string }>; factors?: Array<{ key: string; detail: string }> }>
    | undefined;
  const m = matches?.[0];
  if (!m) return null;
  const ase = m.tags?.find((t) => t.text.startsWith("ASE") || t.text.startsWith("No ASE"))?.text ?? null;
  const quality = m.factors?.find((f) => f.key === "quality")?.detail ?? "";
  const rating = /^(\d(?:\.\d)?) stars/.exec(quality)?.[1];
  return { ase, rating: rating ? Number(rating) : null };
}

// The "Uber-style" live job view: a street map with the mechanic moving toward the
// driver, a live ETA and status, and the mechanic's card.
export function JobTracker({
  requestId,
  status,
  acceptedAt,
  fallbackIso,
  etaMinutes,
  mechanicName,
  vehicle,
}: {
  requestId: string;
  status: string;
  acceptedAt: string | null;
  fallbackIso: string;
  etaMinutes: number | null;
  mechanicName: string | null;
  vehicle: string;
}) {
  const now = useNow();
  const [info, setInfo] = useState<MatchInfo | null>(null);
  const [note, setNote] = useState("");

  const eta = etaMinutes ?? 15;

  // Hidden demo switch: opening the page with ?demo=fast plays the whole trip in
  // about 15 seconds, counted from when the page opened. Nothing on screen shows it.
  // Everyone else gets real time. (Read after load so the first paint matches the server.)
  const [fastFrom, setFastFrom] = useState<number | null>(null);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("demo") === "fast") setFastFrom(Date.now());
    } catch {
      // No URL access: stay at normal speed.
    }
  }, []);
  const speed = fastFrom === null ? 1 : fastDemoSpeed(eta);
  const acceptedAtMs = fastFrom ?? new Date(acceptedAt ?? fallbackIso).getTime();
  const route = DEMO_ROUTES[hashOf(requestId) % DEMO_ROUTES.length];
  const state = trackingState({ status, acceptedAtMs, etaMinutes: eta, nowMs: now, speed });

  useEffect(() => {
    let stopped = false;
    postJson("/api/match", { requestId }).then(({ ok, data }) => {
      if (stopped || !ok) return; // keep what we had if a refresh fails
      const next = readMatch(data);
      if (next) setInfo(next);
    });
    return () => {
      stopped = true;
    };
  }, [requestId, status, etaMinutes]);

  const points = useMemo(() => route.points, [route]);
  const name = mechanicName ?? "Your mechanic";
  const steps = ["Mechanic assigned", "En route to your location", "Arrived"];
  const activeStep = state.phase === "assigned" ? 0 : state.phase === "enroute" ? 1 : 2;

  return (
    <div className="tracker">
      <div className="tracker-status" aria-live="polite">
        <div>
          <p className="tracker-label">{state.label}</p>
          <ol className="tracker-steps" aria-label="Job progress">
            {steps.map((s, i) => (
              <li key={s} className={i <= activeStep ? "on" : ""} aria-current={i === activeStep ? "step" : undefined}>
                <span className="sr-only">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className={"tracker-eta" + (state.phase === "arrived" ? " tracker-eta-done" : "")}>{state.etaText}</p>
      </div>

      <TrackingMap points={points} status={status} acceptedAtMs={acceptedAtMs} etaMinutes={eta} speed={speed} />

      <div className="mech-card">
        <div className="mech-row">
          <div className="mech-avatar" aria-hidden="true">
            {initialsOf(name)}
          </div>
          <div className="mech-who">
            <p className="mech-name">{name}</p>
            <p className="mech-sub">
              {info?.rating != null && (
                <span className="mech-rating" title="Demo rating">
                  <span aria-hidden="true">★</span> {info.rating.toFixed(1)}
                </span>
              )}
              <span>{demoVan(requestId)}</span>
            </p>
          </div>
        </div>
        <div className="mech-tags">
          <span className="badge badge-success">Verified mechanic</span>
          {info?.ase && !info.ase.startsWith("No ") && <span className="badge badge-success">{info.ase}</span>}
        </div>
        {vehicle && <p className="mech-sub">Servicing your {vehicle}</p>}
        <div className="mech-actions">
          <button type="button" className="btn btn-google" onClick={() => setNote("Messaging")}>
            Message
          </button>
          <button type="button" className="btn btn-google" onClick={() => setNote("Calling")}>
            Call
          </button>
        </div>
        {note && (
          <p className="muted small" role="status">
            {note} {name} through NemaGo isn&rsquo;t switched on yet. This is a demo, and no phone number is shared
            with drivers.
          </p>
        )}
        <p className="match-demo-note">
          Demo tracking: the map position, rating and van are simulated from your mechanic&rsquo;s real accept time
          and ETA. Certification is real.
        </p>
      </div>
    </div>
  );
}
