// Vehicle helpers (PRD F1): checking what a driver types, showing a car in one
// line, and writing the car and triage into the request description.
// No imports, so it runs in the browser, on the server and in tests.

export const MAX_VEHICLES = 10;
export const MIN_YEAR = 1980;

export type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  mileage: number;
};

export type VehicleInput = Omit<Vehicle, "id">;

// Letters, numbers and the punctuation real model names use: "F-150", "CR-V",
// "Mazda3", "Grand Cherokee", "Ram 1500 (Classic)".
const NAME = /^[\p{L}\p{N} .'\-\/&+()]+$/u;

function whole(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "");
    return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
  }
  return null;
}

export type VehicleCheck = { ok: true; value: VehicleInput } | { ok: false; error: string };

export function validateVehicle(
  input: { year: unknown; make: unknown; model: unknown; mileage: unknown },
  today: Date = new Date(),
): VehicleCheck {
  const year = whole(input.year);
  const maxYear = today.getFullYear() + 1;
  if (year === null || year < MIN_YEAR || year > maxYear) {
    return { ok: false, error: `Enter a year between ${MIN_YEAR} and ${maxYear}.` };
  }

  const make = typeof input.make === "string" ? input.make.trim() : "";
  if (make.length < 1 || make.length > 40 || !NAME.test(make)) {
    return { ok: false, error: "Enter the make, for example Honda or Toyota." };
  }

  const model = typeof input.model === "string" ? input.model.trim() : "";
  if (model.length < 1 || model.length > 60 || !NAME.test(model)) {
    return { ok: false, error: "Enter the model, for example Civic or Camry." };
  }

  const mileage = whole(input.mileage);
  if (mileage === null || mileage < 0 || mileage > 999999) {
    return { ok: false, error: "Enter the mileage as a whole number, for example 62000." };
  }

  return { ok: true, value: { year, make, model, mileage } };
}

export function formatVehicle(v: Pick<Vehicle, "year" | "make" | "model">) {
  return `${v.year} ${v.make} ${v.model}`;
}

export function formatMileage(miles: number) {
  return miles.toLocaleString("en-US") + " mi";
}

export type TriageSummary = { likelyCause: string; confidence: string };

// The request description mechanics see. The database request has no separate
// vehicle column, so the car and the triage travel as text:
//   "2018 Honda Civic, 62,000 mi. White smoke under the hood (Triage: Coolant leak, High confidence)"
// The checkout allows 3 to 500 characters; the driver's own words are shortened
// first if the whole thing would be too long.
export function composeProblem(
  parts: { vehicle?: Vehicle | null; description: string; triage?: TriageSummary | null },
  max = 500,
): string {
  const prefix = parts.vehicle
    ? `${formatVehicle(parts.vehicle)}, ${formatMileage(parts.vehicle.mileage)}. `
    : "";
  let suffix = parts.triage
    ? ` (Triage: ${parts.triage.likelyCause}, ${parts.triage.confidence} confidence)`
    : "";

  let description = parts.description.trim();
  if (!description && parts.triage) description = "Needs diagnosis";

  // Keep the driver's own words, but never go over the limit.
  const room = (s: string) => max - prefix.length - s.length;
  if (room(suffix) < 20) suffix = ""; // a very long cause: drop the triage note, keep their words
  const budget = room(suffix);
  if (description.length > budget) description = description.slice(0, Math.max(0, budget - 1)).trimEnd() + "…";

  const text = (prefix + description + suffix).trim();
  return text.length >= 3 ? text.slice(0, max) : "Needs diagnosis";
}
