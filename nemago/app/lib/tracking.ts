// Live tracking maths for the driver's job screen. Pure functions, no imports,
// so the map, the status text and the tests all agree.
//
// The mechanic's position is SIMULATED: NemaGo has no live location yet (and live
// locations must never be stored). So we place the mechanic on a saved road route
// using only two real facts: when they accepted, and the ETA they promised.

export type LatLng = [number, number];

// How long the card says "Mechanic assigned" before the van starts moving.
export const ASSIGNED_SECONDS = 15;
// Inside this many seconds the ETA reads "Arriving now".
export const ARRIVING_SECONDS = 45;

export type TrackingPhase = "assigned" | "enroute" | "arrived";

export type TrackingState = {
  phase: TrackingPhase;
  label: string; // the status line
  etaText: string; // "14 min", "Arriving now" or "Arrived"
  fraction: number; // 0 (start of route) to 1 (at the driver)
};

export function trackingState(input: {
  status: string;
  acceptedAtMs: number;
  etaMinutes: number;
  nowMs: number;
  // 1 = real time. Only the hidden ?demo=fast URL switch ever sets this higher.
  speed?: number;
}): TrackingState {
  // The mechanic's own "I've arrived" tap is the only thing that says Arrived.
  if (input.status === "arrived" || input.status === "diagnosed" || input.status === "completed") {
    return { phase: "arrived", label: "Arrived", etaText: "Arrived", fraction: 1 };
  }
  const totalSeconds = Math.max(60, input.etaMinutes * 60);
  const elapsed = Math.max(0, ((input.nowMs - input.acceptedAtMs) / 1000) * (input.speed ?? 1));
  const remaining = Math.max(0, totalSeconds - elapsed);
  const etaText = remaining <= ARRIVING_SECONDS ? "Arriving now" : Math.ceil(remaining / 60) + " min";

  if (elapsed < ASSIGNED_SECONDS) {
    return { phase: "assigned", label: "Mechanic assigned", etaText, fraction: 0 };
  }
  const travelSeconds = Math.max(1, totalSeconds - ASSIGNED_SECONDS);
  const fraction = Math.min(1, (elapsed - ASSIGNED_SECONDS) / travelSeconds);
  return { phase: "enroute", label: "En route to your location", etaText, fraction };
}

// Straight-line metres between two points (good enough for a city route).
function metres(a: LatLng, b: LatLng) {
  const dLat = (b[0] - a[0]) * 111_320;
  const dLng = (b[1] - a[1]) * 111_320 * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

// The point `fraction` of the way along the road (by distance, not by point count).
export function pointAlong(points: LatLng[], fraction: number): LatLng {
  if (points.length === 0) return [0, 0];
  if (points.length === 1 || fraction <= 0) return points[0];
  if (fraction >= 1) return points[points.length - 1];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = metres(points[i - 1], points[i]);
    lengths.push(d);
    total += d;
  }
  let target = total * fraction;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] === 0 ? 0 : Math.min(1, target / lengths[i]);
      const a = points[i];
      const b = points[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    target -= lengths[i];
  }
  return points[points.length - 1];
}

// "Rosa Martinez" -> "RM", "Rosa" -> "R".
export function initialsOf(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

// A small stable number from text, so a job always gets the same demo route and van.
export function hashOf(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// SIMULATED service vehicle shown on the mechanic card (no real fleet data yet).
const DEMO_VANS = [
  "White Ford Transit Connect",
  "Silver Ram ProMaster City",
  "White Chevrolet Express",
  "Gray Ford Transit",
];
export function demoVan(requestId: string) {
  return DEMO_VANS[hashOf(requestId + "|van") % DEMO_VANS.length];
}

// Hidden demo switch (?demo=fast): the whole trip plays in about this many seconds.
export const FAST_DEMO_SECONDS = 15;

export function fastDemoSpeed(etaMinutes: number) {
  return Math.max(60, etaMinutes * 60) / FAST_DEMO_SECONDS;
}
