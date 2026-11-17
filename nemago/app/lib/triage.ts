// Guided triage (PRD F1): turns warning lights, symptoms and a short description
// into a plain-English result: likely cause, confidence, safety call and the
// recommended service.
//
// THIS IS A DEMO TRIAGE. It is a small set of fixed rules, NOT an AI vision model.
// No photo is analysed (photos never leave the driver's device). A real model
// would replace `runTriage` behind the same `/api/triage` route; adding an AI
// provider needs the project owner's approval first (see CLAUDE.md).
//
// No imports, so it runs on the server and in tests.

export type Option = { id: string; label: string };

export const WARNING_LIGHTS: Option[] = [
  { id: "check_engine", label: "Check engine" },
  { id: "oil_pressure", label: "Oil pressure" },
  { id: "battery", label: "Battery / charging" },
  { id: "coolant_temp", label: "Engine temperature" },
  { id: "brake", label: "Brake system" },
  { id: "abs", label: "ABS" },
  { id: "tire_pressure", label: "Tire pressure" },
  { id: "airbag", label: "Airbag" },
];

export const SYMPTOMS: Option[] = [
  { id: "smoke_white", label: "White smoke or steam" },
  { id: "smoke_dark", label: "Black or blue smoke" },
  { id: "wont_start", label: "Won't start" },
  { id: "clicking", label: "Clicks when I turn the key" },
  { id: "squeal", label: "Squealing noise" },
  { id: "grinding", label: "Grinding noise" },
  { id: "knocking", label: "Knocking or clunking" },
  { id: "leak", label: "Fluid leak" },
  { id: "burning_smell", label: "Burning smell" },
  { id: "vibration", label: "Shaking or vibration" },
  { id: "pulling", label: "Pulls to one side" },
  { id: "overheating", label: "Running hot" },
  { id: "flat_tire", label: "Flat or low tire" },
  { id: "stalling", label: "Stalling or rough running" },
  { id: "soft_brake", label: "Soft or sinking brake pedal" },
];

export const DEMO_TRIAGE_NOTE =
  "Demo triage: built from simple rules using the warning lights, symptoms and description you chose. No AI vision model has looked at a photo. A mechanic confirms the real cause in person.";

export type SafetyCall = "safe" | "dont_drive" | "move_now";
export type ConfidenceLevel = "Low" | "Medium" | "High";

export type TriageInput = { lights: string[]; symptoms: string[]; description: string };

export type TriageResult = {
  likelyCause: string;
  alternatives: string[];
  confidence: { level: ConfidenceLevel; reason: string };
  safety: { call: SafetyCall; label: string; detail: string };
  recommendedService: string;
  diagnosticVisit: boolean;
  nextSteps: string[];
  signalsUsed: string[];
};

type Safety = { call: SafetyCall; label: string; detail: string };

type Rule = {
  id: string;
  cause: string;
  service: string;
  lights?: Record<string, number>;
  symptoms?: Record<string, number>;
  keywords?: RegExp;
  steps: string[];
  // Decides the safety call from what the driver reported.
  safety: (has: (kind: "light" | "symptom", id: string) => boolean) => Safety;
};

const SAFE_TO_DRIVE = (detail: string): Safety => ({ call: "safe", label: "Safe to drive", detail });
const DONT_DRIVE = (detail: string): Safety => ({ call: "dont_drive", label: "Don't drive", detail });
const MOVE_NOW = (detail: string): Safety => ({ call: "move_now", label: "Move to safety now", detail });

const RULES: Rule[] = [
  {
    id: "cooling",
    cause: "Coolant leak or overheating (hose, radiator, thermostat or water pump)",
    service: "Cooling system inspection and repair",
    lights: { coolant_temp: 3 },
    symptoms: { smoke_white: 2.5, overheating: 2.5, leak: 0.8 },
    keywords: /\b(coolant|radiator|steam|overheat|temperature|sweet smell|white smoke|running hot)/,
    steps: [
      "Pull over somewhere safe and turn the engine off.",
      "Let it cool for about 30 minutes. Never open the radiator cap while it's hot.",
      "Don't drive it again until a mechanic has looked at it.",
    ],
    safety: (has) =>
      has("light", "coolant_temp") || has("symptom", "overheating") || has("symptom", "smoke_white")
        ? MOVE_NOW("Overheating can wreck an engine in minutes. Pull over, switch the engine off and let it cool.")
        : DONT_DRIVE("A cooling leak can lead to overheating. Avoid driving until it's checked."),
  },
  {
    id: "battery",
    cause: "Weak or dead battery, or a charging fault (alternator)",
    service: "Battery and charging system test, with a jump-start or replacement on site",
    lights: { battery: 3 },
    symptoms: { wont_start: 2, clicking: 3 },
    keywords: /\b(battery|jump|dead|alternator|starter|no crank|slow crank|clicking|wont start|will not start|doesnt start|cant start)/,
    steps: [
      "Turn off the radio, lights and A/C to save power.",
      "If you're parked somewhere unsafe, turn on your hazard lights.",
      "A mobile mechanic can test and jump or replace the battery where you are.",
    ],
    safety: (has) =>
      has("symptom", "wont_start") || has("symptom", "clicking")
        ? { call: "safe", label: "Safe where you are", detail: "You're not in danger. The car just can't be driven until it's fixed. Stay somewhere safe." }
        : DONT_DRIVE("If the battery light came on while driving, the car may stall soon. Get somewhere safe and have it checked."),
  },
  {
    id: "brakes",
    cause: "Worn brake pads, low brake fluid or a brake system fault",
    service: "Brake inspection and pad or fluid service",
    lights: { brake: 3, abs: 1.5 },
    symptoms: { soft_brake: 3, grinding: 2, squeal: 1, burning_smell: 0.5 },
    keywords: /\b(brake|brakes|braking|pedal|stopping)/,
    steps: [
      "Leave extra space around other cars and brake early.",
      "Avoid highways and hills until your brakes are checked.",
      "If the pedal sinks to the floor, stop driving and book a mechanic to you.",
    ],
    safety: (has) =>
      has("symptom", "soft_brake") || has("light", "brake") || has("symptom", "grinding")
        ? DONT_DRIVE("Brakes are a safety system. Don't drive until they're checked.")
        : SAFE_TO_DRIVE("Drive slowly, leave extra space and avoid highways until the brakes are checked."),
  },
  {
    id: "tires",
    cause: "Puncture, slow leak or a damaged valve stem",
    service: "Tire patch or plug, or a spare-tire swap on site",
    lights: { tire_pressure: 3 },
    symptoms: { flat_tire: 3.5, vibration: 0.5, leak: 0.3 },
    keywords: /\b(tire|tires|tyre|flat|puncture|nail|losing air)/,
    steps: [
      "Check the tire for a visible nail or screw, but don't pull it out.",
      "If you have a spare and know how to fit it safely, that gets you to a shop.",
      "Otherwise a mechanic can patch or swap the tire where you're parked.",
    ],
    safety: (has) =>
      has("symptom", "flat_tire")
        ? DONT_DRIVE("Driving on a flat tire can ruin the wheel and be unsafe. Stay put or use your spare.")
        : SAFE_TO_DRIVE("Check the pressure at your next stop and drive gently. Stop if the tire feels soft."),
  },
  {
    id: "oil",
    cause: "Low oil level or lost oil pressure",
    service: "Oil level check and engine diagnostic",
    lights: { oil_pressure: 4 },
    symptoms: { knocking: 1.5, smoke_dark: 1.5, burning_smell: 1 },
    keywords: /\b(oil)/,
    steps: [
      "Switch the engine off and wait a few minutes.",
      "When it's cool, check the oil with the dipstick. If it's low, don't drive.",
      "A mobile mechanic can add oil and check for a leak or a failing part.",
    ],
    safety: (has) =>
      has("light", "oil_pressure")
        ? MOVE_NOW("Driving without oil pressure can destroy the engine in minutes. Pull over and switch it off.")
        : DONT_DRIVE("Check your oil level before driving. If it's low, don't drive."),
  },
  {
    id: "engine",
    cause: "Engine sensor, ignition or fuel-system fault (needs a code scan)",
    service: "Diagnostic scan and engine performance check",
    lights: { check_engine: 3 },
    symptoms: { stalling: 3, smoke_dark: 1 },
    keywords: /\b(misfire|rough idle|rough|stall|check engine|engine light|hesitat|sputter)/,
    steps: [
      "Check that your gas cap is tight. A loose cap can trigger this light.",
      "If the light is flashing, stop driving: that can damage the engine.",
      "A mechanic can read the fault code on site to see exactly which part is reporting.",
    ],
    safety: (has) =>
      has("symptom", "stalling")
        ? DONT_DRIVE("Stalling can happen in traffic. Avoid busy roads until it's checked.")
        : SAFE_TO_DRIVE("A steady light is usually safe for a short trip. If it flashes, stop driving."),
  },
  {
    id: "belt",
    cause: "Worn or loose serpentine belt (or its tensioner)",
    service: "Belt and tensioner inspection and replacement",
    lights: { battery: 1 },
    symptoms: { squeal: 2.5, burning_smell: 1 },
    keywords: /\b(belt|squeal|chirp|screech)/,
    steps: [
      "Listen for whether the squeal is loudest when you start the car or turn the wheel.",
      "Short trips are usually okay, but if the belt snaps you'll lose steering assist and battery charging.",
      "Belt replacement is a quick job a mobile mechanic can do on site.",
    ],
    safety: () => SAFE_TO_DRIVE("Short trips are usually okay. If the belt snaps you'll lose power steering and battery charging."),
  },
  {
    id: "suspension",
    cause: "Tire balance, wheel alignment or worn suspension parts",
    service: "Wheel, tire and suspension inspection",
    symptoms: { vibration: 2.5, pulling: 3, knocking: 2 },
    keywords: /\b(shake|shaking|vibrat|wobble|clunk|pulls to|pulling to|steering|alignment|bumps)/,
    steps: [
      "Notice when it happens: at highway speed, when braking, or over bumps.",
      "Slow down and avoid highways until it's checked.",
      "Tell the mechanic what you noticed. It narrows the cause quickly.",
    ],
    safety: () => SAFE_TO_DRIVE("Slow down and avoid highways until it's checked."),
  },
  {
    id: "exhaust",
    cause: "Burning oil or an over-rich fuel mixture",
    service: "Engine diagnostic and oil level check",
    symptoms: { smoke_dark: 3 },
    keywords: /\b(black smoke|blue smoke|grey smoke|gray smoke|exhaust)/,
    steps: [
      "Check your oil level when the engine is cool.",
      "A dirty air filter or a worn seal is a common cause.",
      "A mechanic can find the source on site.",
    ],
    safety: () => SAFE_TO_DRIVE("Check your oil first. If it's low, don't drive."),
  },
  {
    id: "airbag",
    cause: "Airbag (SRS) system fault",
    service: "Diagnostic scan of the airbag system",
    lights: { airbag: 4 },
    keywords: /\b(airbag|srs)/,
    steps: [
      "The car drives normally, but the airbags may not work in a crash.",
      "Book a scan soon rather than waiting.",
    ],
    safety: () => SAFE_TO_DRIVE("It drives normally, but your airbags may not deploy in a crash until it's fixed."),
  },
  {
    id: "leak",
    cause: "Fluid leak (coolant, oil or brake fluid; the color tells which)",
    service: "Leak inspection to find and fix the source",
    symptoms: { leak: 3 },
    keywords: /\b(leak|puddle|dripping|fluid)/,
    steps: [
      "Look at the color on the ground: green, orange or pink is usually coolant; brown or black is oil.",
      "Clear, slippery fluid near a wheel could be brake fluid. Don't drive in that case.",
      "Take a photo of the spot to show the mechanic.",
    ],
    safety: () => DONT_DRIVE("Until we know which fluid it is, avoid driving. A brake or coolant leak can be dangerous."),
  },
  {
    id: "burning",
    cause: "An overheating part (brakes, a belt, oil on hot parts or an electrical fault)",
    service: "Inspection to find what is overheating",
    symptoms: { burning_smell: 3 },
    keywords: /\b(burning smell|smell burning|smells like burning|burning rubber|burnt)/,
    steps: [
      "Pull over safely and look for smoke.",
      "If it smells like plastic or electrical, turn the car off.",
      "Have a mechanic find the source before you drive again.",
    ],
    safety: () => DONT_DRIVE("A burning smell can mean a part is overheating. Stop somewhere safe and avoid driving until it's checked."),
  },
];

const EMERGENCY =
  /\b(on fire|caught fire|flames|no brakes|brakes failed|brakes not working|brake pedal goes to the floor|cant steer|lost steering)/;

const lightLabel = (id: string) => WARNING_LIGHTS.find((o) => o.id === id)?.label ?? id;
const symptomLabel = (id: string) => SYMPTOMS.find((o) => o.id === id)?.label ?? id;

const SEVERITY: Record<SafetyCall, number> = { safe: 0, dont_drive: 1, move_now: 2 };

type Scored = { rule: Rule; score: number; kinds: Set<string>; used: string[] };

export function runTriage(input: TriageInput): TriageResult {
  const lights = new Set(input.lights);
  const symptoms = new Set(input.symptoms);
  const text = input.description.toLowerCase().replace(/['’]/g, "");
  const has = (kind: "light" | "symptom", id: string) => (kind === "light" ? lights : symptoms).has(id);

  if (EMERGENCY.test(text)) {
    return {
      likelyCause: "Possible fire or complete brake or steering loss",
      alternatives: [],
      confidence: { level: "High", reason: "You described an emergency." },
      safety: {
        call: "move_now",
        label: "Move to safety now",
        detail: "Get everyone away from the road. Call 911 if there is fire or you can't stop.",
      },
      recommendedService: "Emergency: get safe and call 911 first. Book a mechanic once you're out of danger.",
      diagnosticVisit: false,
      nextSteps: [
        "Turn the car off and get out if it's safe to do so.",
        "Move away from traffic and call 911 if there is fire or you cannot stop.",
        "Once you're safe, you can book a mechanic.",
      ],
      signalsUsed: ["Your description mentions an emergency"],
    };
  }

  const scored: Scored[] = RULES.map((rule) => {
    let score = 0;
    const kinds = new Set<string>();
    const used: string[] = [];
    for (const [id, weight] of Object.entries(rule.lights ?? {})) {
      if (lights.has(id)) {
        score += weight;
        kinds.add("light");
        used.push("Warning light: " + lightLabel(id));
      }
    }
    for (const [id, weight] of Object.entries(rule.symptoms ?? {})) {
      if (symptoms.has(id)) {
        score += weight;
        kinds.add("symptom");
        used.push("Symptom: " + symptomLabel(id));
      }
    }
    if (rule.keywords && text) {
      const hit = text.match(rule.keywords);
      if (hit) {
        score += 1.5;
        kinds.add("text");
        used.push("Your description: \"" + hit[0].trim() + "\"");
      }
    }
    return { rule, score, kinds, used };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];

  // How sure are we? Several different kinds of signal agreeing counts for more.
  let level: ConfidenceLevel = "Low";
  let reason = "There isn't enough to be sure, so a mechanic should look at it in person.";
  if (top) {
    const margin = top.score - (second?.score ?? 0);
    if (top.score >= 5 && top.kinds.size >= 2 && margin >= 1.5) {
      level = "High";
      reason = "Your warning light, symptoms and description point the same way.";
    } else if (top.score >= 3) {
      level = "Medium";
      reason = "This is the best fit, but other causes are possible.";
    }
  }

  // Safety is judged on the most serious strong signal, not just the top cause.
  const strong = scored.filter((s) => s.score >= 3);
  let safety: Safety;
  if (strong.length > 0) {
    const verdicts = strong.map((s) => ({ s, v: s.rule.safety(has) }));
    verdicts.sort((a, b) => SEVERITY[b.v.call] - SEVERITY[a.v.call] || b.s.score - a.s.score);
    safety = verdicts[0].v;
  } else if (top) {
    safety = top.rule.safety(has);
  } else {
    safety = DONT_DRIVE("We can't tell how serious this is from what you've told us. If it feels unsafe, don't drive it.");
  }

  const diagnosticVisit = level === "Low";
  const likelyCause = !top
    ? "We can't tell from this alone"
    : diagnosticVisit
      ? "Not certain yet. Most likely: " + top.rule.cause
      : top.rule.cause;

  return {
    likelyCause,
    alternatives: scored
      .slice(1, 3)
      .filter((s) => s.score >= 1.5)
      .map((s) => s.rule.cause),
    confidence: { level, reason },
    safety,
    recommendedService: diagnosticVisit
      ? "Diagnostic visit: a mechanic inspects your car in person and tells you what's wrong."
      : top.rule.service,
    diagnosticVisit,
    nextSteps: top ? top.rule.steps : ["Describe what you see, hear or smell, or pick a warning light, for a better result."],
    signalsUsed: top ? top.used : [],
  };
}

// ---------------------------------------------------------------------------
// Checking what the browser sent (used by the API route and the tests)
// ---------------------------------------------------------------------------

export type TriageCheck = { ok: true; value: TriageInput } | { ok: false };

export function parseTriageInput(body: Record<string, unknown>): TriageCheck {
  const pick = (raw: unknown, allowed: Option[]): string[] | null => {
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || raw.length > 10) return null;
    const ids = new Set(allowed.map((o) => o.id));
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string" || !ids.has(item)) return null;
      if (!out.includes(item)) out.push(item);
    }
    return out;
  };

  const lights = pick(body.lights, WARNING_LIGHTS);
  const symptoms = pick(body.symptoms, SYMPTOMS);
  if (lights === null || symptoms === null) return { ok: false };

  const description = body.description === undefined ? "" : body.description;
  if (typeof description !== "string" || description.length > 300) return { ok: false };

  const trimmed = description.trim();
  // Need at least something to go on.
  if (lights.length === 0 && symptoms.length === 0 && trimmed.length < 3) return { ok: false };
  return { ok: true, value: { lights, symptoms, description: trimmed } };
}

// ---------------------------------------------------------------------------
// Handing a triage over to the request screen
// ---------------------------------------------------------------------------

// The triage page leaves a short note in the browser's session storage and the
// request screen reads it. Nothing travels in the web address, so no personal
// text ends up in a URL. It expires after an hour.
export const TRIAGE_HANDOFF_KEY = "nemago.triage";
export const TRIAGE_HANDOFF_MAX_AGE_MS = 60 * 60 * 1000;

export type TriageHandoff = {
  vehicleId: string | null;
  description: string;
  triage: { likelyCause: string; confidence: string };
  createdAt: number;
};
