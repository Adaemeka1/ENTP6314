// Smart Dispatch Match (PRD F3): scores and ranks mechanics for a job on five
// weighted factors, and explains the score in plain words.
//
// REAL inputs today: the mechanic's saved ASE certification, and whether they are
// verified with payouts set up (the server only passes eligible mechanics in).
// SIMULATED inputs: proximity/ETA, shift, parts readiness, rating and acceptance
// rate. NemaGo has no live location, shift schedule, parts inventory or ratings
// yet, so these come from a fixed pseudo-random function of the mechanic and job.
// The screens label them "Demo signals". Replace `demoSignals` when real data exists.
//
// This file has no imports so it can run in the browser, on the server and in tests.

// Placeholder weights (an open decision in the PRD). They must add up to 100.
export const MATCH_WEIGHTS = {
  proximity: 30,
  skill: 25,
  shift: 20,
  parts: 10,
  quality: 15,
} as const;

export type FactorKey = keyof typeof MATCH_WEIGHTS;

export const FACTOR_LABELS: Record<FactorKey, string> = {
  proximity: "Proximity & live ETA",
  skill: "ASE skill match",
  shift: "Active shift availability",
  parts: "Local parts readiness",
  quality: "Quality score",
};

export const DEMO_NOTE =
  "Demo signals: distance, shift, parts and ratings are simulated until live data exists. ASE certification is real.";

// ---------------------------------------------------------------------------
// What kind of problem is it? (decides which ASE specialty matters)
// ---------------------------------------------------------------------------

export type IssueCategory =
  | "cooling"
  | "brakes"
  | "electrical"
  | "tires"
  | "suspension"
  | "engine"
  | "general";

export const ISSUE_LABELS: Record<IssueCategory, string> = {
  cooling: "cooling system",
  brakes: "brakes",
  electrical: "starting and electrical",
  tires: "tires",
  suspension: "steering and suspension",
  engine: "engine",
  general: "general repair",
};

// ASE test areas: A1 Engine Repair, A2 Automatic Transmission, A3 Manual Drive
// Train, A4 Suspension & Steering, A5 Brakes, A6 Electrical/Electronic,
// A7 Heating & A/C, A8 Engine Performance, A9 Light Vehicle Diesel.
const ASE_FOR_ISSUE: Record<IssueCategory, { primary: string[]; secondary: string[] }> = {
  cooling: { primary: ["A1"], secondary: ["A8", "A7"] },
  brakes: { primary: ["A5"], secondary: ["A4"] },
  electrical: { primary: ["A6"], secondary: ["A8"] },
  tires: { primary: ["A4"], secondary: ["A5"] },
  suspension: { primary: ["A4"], secondary: ["A5"] },
  engine: { primary: ["A8", "A1"], secondary: ["A6"] },
  general: { primary: [], secondary: [] },
};

const ISSUE_PATTERNS: Array<[IssueCategory, RegExp]> = [
  ["cooling", /\b(white smoke|steam|overheat|coolant|radiator|temperature gauge|running hot|sweet smell|heater)/],
  ["brakes", /\b(brake|brakes|braking|grinding when i stop|squeal when i stop|pedal)/],
  ["electrical", /\b(battery|wont start|will not start|doesnt start|cant start|no crank|slow crank|clicking|alternator|starter|dead|fuse|headlight|charging)/],
  ["tires", /\b(tire|tires|tyre|flat|puncture|tpms|losing air)/],
  ["suspension", /\b(clunk|shake|shaking|vibrat|wobble|pulls to|pulling to|steering|bumps|alignment)/],
  ["engine", /\b(smoke|check engine|engine light|stall|rough idle|hesitat|sputter|misfire|knock|ticking|tapping|oil|burning smell|leak|puddle|fluid)/],
];

export function classifyIssue(problem: string | null | undefined): IssueCategory {
  if (!problem) return "general";
  const text = problem.toLowerCase().replace(/['’]/g, "");
  for (const [category, pattern] of ISSUE_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return "general";
}

// ---------------------------------------------------------------------------
// Reading a saved certification like "ASE A1-A8", "ASE Master" or "A5, A6"
// ---------------------------------------------------------------------------

export type AseInfo = { hasAse: boolean; codes: string[]; expired: boolean };

export function parseAse(
  certificationName: string | null | undefined,
  expiresOn: string | null | undefined,
  today: Date,
): AseInfo {
  const text = (certificationName ?? "").trim();
  if (!text) return { hasAse: false, codes: [], expired: false };

  const expired = Boolean(expiresOn) && new Date(expiresOn as string).getTime() < today.getTime();
  const codes = new Set<string>();

  if (/master/i.test(text)) for (let n = 1; n <= 8; n++) codes.add("A" + n);

  for (const m of text.matchAll(/\bA\s?([1-9])\s*[-–]\s*A?\s?([1-9])\b/gi)) {
    const lo = Math.min(Number(m[1]), Number(m[2]));
    const hi = Math.max(Number(m[1]), Number(m[2]));
    for (let n = lo; n <= hi; n++) codes.add("A" + n);
  }
  for (const m of text.matchAll(/\bA\s?([1-9])\b/gi)) codes.add("A" + m[1]);

  const hasAse = /\bASE\b/i.test(text) || codes.size > 0;
  return { hasAse, codes: [...codes].sort(), expired };
}

// ---------------------------------------------------------------------------
// Simulated signals (see the note at the top of this file)
// ---------------------------------------------------------------------------

// A fixed pseudo-random number between 0 and 1 for a piece of text (FNV-1a).
function unit(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

export type ShiftState = "on_shift" | "ending_soon" | "on_break";
export type PartsState = "ready" | "can_source" | "none";

export type DemoSignals = {
  etaMinutes: number;
  distanceMiles: number;
  shift: ShiftState;
  parts: PartsState;
  rating: number;
  acceptanceRate: number;
};

export function demoSignals(mechanicId: string, requestId: string, issue: IssueCategory): DemoSignals {
  const etaMinutes = 6 + Math.floor(unit(mechanicId + "|" + requestId + "|eta") * 19); // 6 to 24
  const shiftRoll = unit(mechanicId + "|" + requestId + "|shift");
  const partsRoll = unit(mechanicId + "|" + issue + "|parts");
  return {
    etaMinutes,
    distanceMiles: Math.round(etaMinutes * 5) / 10, // about 30 mph
    shift: shiftRoll < 0.8 ? "on_shift" : shiftRoll < 0.95 ? "ending_soon" : "on_break",
    parts: partsRoll < 0.55 ? "ready" : partsRoll < 0.85 ? "can_source" : "none",
    rating: 5.0, // DEMO: every demo mechanic shows 5.0 stars until real ratings exist
    acceptanceRate: Math.round((0.72 + unit(mechanicId + "|accept") * 0.26) * 100) / 100, // 72% to 98%
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type Candidate = {
  id: string;
  certificationName: string | null;
  certificationExpiresOn: string | null;
};

export type Factor = {
  key: FactorKey;
  label: string;
  weight: number;
  // How well this mechanic does on this factor, from 0 to 1.
  score: number;
  // The points earned out of `weight`.
  points: number;
  detail: string;
};

export type Tag = { text: string; tone: "good" | "neutral" | "warn" };

export type MatchResult = {
  mechanicId: string;
  score: number; // 0 to 100
  etaMinutes: number;
  etaIsLive: boolean;
  issue: IssueCategory;
  tags: Tag[];
  factors: Factor[];
};

// Everything except the mechanic's id: safe to send to a driver's browser.
export type PublicMatch = Omit<MatchResult, "mechanicId">;

export function toPublic(match: MatchResult): PublicMatch {
  const copy: Partial<MatchResult> = { ...match };
  delete copy.mechanicId;
  return copy as PublicMatch;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreMechanic(
  candidate: Candidate,
  problem: string | null | undefined,
  requestId: string,
  options: { committedEtaMinutes?: number | null; today?: Date } = {},
): MatchResult {
  const today = options.today ?? new Date();
  const issue = classifyIssue(problem);
  const demo = demoSignals(candidate.id, requestId, issue);

  // 1. Proximity & live ETA: 5 minutes away is perfect, 45 or more scores zero.
  // Once a mechanic has accepted, their own ETA replaces the estimate.
  const etaIsLive = options.committedEtaMinutes != null;
  const etaMinutes = etaIsLive ? (options.committedEtaMinutes as number) : demo.etaMinutes;
  const proximity = clamp01(1 - (etaMinutes - 5) / 40);
  const proximityDetail = etaIsLive
    ? `${etaMinutes} min away (the mechanic's own ETA)`
    : `${etaMinutes} min away, about ${demo.distanceMiles} mi (estimate)`;

  // 2. ASE skill match for this kind of problem (real data).
  const ase = parseAse(candidate.certificationName, candidate.certificationExpiresOn, today);
  const wanted = ASE_FOR_ISSUE[issue];
  let skill: number;
  let skillDetail: string;
  let skillTag: Tag;
  if (!ase.hasAse || ase.expired) {
    skill = 0.1;
    skillDetail = ase.expired ? "ASE certification has expired" : "No ASE certification on file";
    skillTag = { text: ase.expired ? "ASE Expired" : "No ASE Certification", tone: "warn" };
  } else if (ase.codes.length === 0) {
    skill = 0.6;
    skillDetail = "ASE certified (specialties not listed)";
    skillTag = { text: "ASE Certified", tone: "good" };
  } else if (issue === "general") {
    skill = 0.8;
    skillDetail = `ASE ${ase.codes.join(", ")} (general repair)`;
    skillTag = { text: "ASE Certified", tone: "good" };
  } else if (wanted.primary.some((c) => ase.codes.includes(c))) {
    const hit = wanted.primary.find((c) => ase.codes.includes(c));
    skill = 1;
    skillDetail = `ASE ${hit} covers ${ISSUE_LABELS[issue]}`;
    skillTag = { text: "ASE Certified", tone: "good" };
  } else if (wanted.secondary.some((c) => ase.codes.includes(c))) {
    const hit = wanted.secondary.find((c) => ase.codes.includes(c));
    skill = 0.7;
    skillDetail = `ASE ${hit} is related to ${ISSUE_LABELS[issue]}`;
    skillTag = { text: "ASE Certified", tone: "good" };
  } else {
    skill = 0.35;
    skillDetail = `ASE ${ase.codes.join(", ")}, not this specialty`;
    skillTag = { text: "ASE: Other Specialty", tone: "neutral" };
  }

  // 3. Active shift availability (simulated).
  const shiftScore = demo.shift === "on_shift" ? 1 : demo.shift === "ending_soon" ? 0.55 : 0.3;
  const shiftDetail =
    demo.shift === "on_shift" ? "On shift now" : demo.shift === "ending_soon" ? "Shift ends soon" : "On a break";

  // 4. Local parts sourcing readiness (simulated).
  const partsScore = demo.parts === "ready" ? 1 : demo.parts === "can_source" ? 0.6 : 0.2;
  const partsDetail =
    demo.parts === "ready"
      ? `Carries common ${ISSUE_LABELS[issue]} parts`
      : demo.parts === "can_source"
        ? "Can source parts locally"
        : "No parts on hand";
  const partsTag: Tag =
    demo.parts === "ready"
      ? { text: "Parts Ready", tone: "good" }
      : demo.parts === "can_source"
        ? { text: "Can Source Parts", tone: "neutral" }
        : { text: "Parts Not On Hand", tone: "warn" };

  // 5. Quality score: driver rating and acceptance rate (simulated).
  const ratingScore = clamp01((demo.rating - 3) / 2);
  const quality = 0.6 * ratingScore + 0.4 * demo.acceptanceRate;
  const qualityDetail = `${demo.rating.toFixed(1)} stars, ${Math.round(demo.acceptanceRate * 100)}% accept rate`;

  const parts: Array<[FactorKey, number, string]> = [
    ["proximity", proximity, proximityDetail],
    ["skill", skill, skillDetail],
    ["shift", shiftScore, shiftDetail],
    ["parts", partsScore, partsDetail],
    ["quality", quality, qualityDetail],
  ];
  const factors: Factor[] = parts.map(([key, value, detail]) => ({
    key,
    label: FACTOR_LABELS[key],
    weight: MATCH_WEIGHTS[key],
    score: round1(value * 100) / 100,
    points: round1(MATCH_WEIGHTS[key] * value),
    detail,
  }));

  const total = parts.reduce((sum, [key, value]) => sum + MATCH_WEIGHTS[key] * value, 0);

  return {
    mechanicId: candidate.id,
    score: Math.round(total),
    etaMinutes,
    etaIsLive,
    issue,
    tags: [{ text: `${etaMinutes} mins away`, tone: "neutral" }, skillTag, partsTag],
    factors,
  };
}

// Best match first. Ties go to the closer mechanic, then to the id so the order
// never jumps around between refreshes.
export function rankMechanics(
  candidates: Candidate[],
  problem: string | null | undefined,
  requestId: string,
  options: { today?: Date } = {},
): MatchResult[] {
  return candidates
    .map((c) => scoreMechanic(c, problem, requestId, options))
    .sort(
      (a, b) =>
        b.score - a.score || a.etaMinutes - b.etaMinutes || a.mechanicId.localeCompare(b.mechanicId),
    );
}
