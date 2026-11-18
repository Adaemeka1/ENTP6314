// Checking a booking request. The booking screens use this to show errors early,
// and the server (/api/checkout) runs the SAME checks on every request, because
// the browser can't be trusted. No imports from the app, so it runs anywhere.

import { findService, shortServiceName } from "./services";
import { composeProblem, validateCar } from "./vehicles";

export type BookingType = "diagnosis" | "fixed_price";

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const PLATE = /^[A-Z0-9][A-Z0-9 -]{0,8}[A-Z0-9]$/;

export type VehicleIdCheck =
  | { ok: true; vin: string | null; plate: string | null }
  | { ok: false; error: string };

// A VIN is 17 letters and numbers (never I, O or Q). A license plate is 2 to 10
// letters, numbers, spaces or hyphens. The diagnosis path requires a VIN.
export function parseVehicleId(raw: unknown, requireVin: boolean): VehicleIdCheck {
  const text = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  const compact = text.replace(/[\s-]/g, "");
  if (VIN.test(compact)) return { ok: true, vin: compact, plate: null };
  if (requireVin) {
    return { ok: false, error: "Enter your 17-character VIN (letters and numbers, without I, O or Q)." };
  }
  if (text.length >= 2 && text.length <= 10 && PLATE.test(text)) {
    return { ok: true, vin: null, plate: text };
  }
  return { ok: false, error: "Enter your 17-character VIN or your license plate." };
}

export type BookingRequest = {
  type: BookingType;
  serviceId: string | null;
  year: number;
  make: string;
  model: string;
  vin: string | null;
  plate: string | null;
  problem: string;
  area: string;
  address: string;
};

export type BookingCheck = { ok: true; value: BookingRequest } | { ok: false; error: string };

function text(value: unknown, min: number, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

export function validateBookingRequest(body: Record<string, unknown>, today: Date = new Date()): BookingCheck {
  const type = body.type;
  if (type !== "diagnosis" && type !== "fixed_price") return { ok: false, error: "Choose how we can help." };

  let serviceId: string | null = null;
  if (type === "fixed_price") {
    const service = typeof body.serviceId === "string" ? findService(body.serviceId) : null;
    if (!service) return { ok: false, error: "Choose a service from the menu." };
    serviceId = service.id;
  }

  const car = validateCar({ year: body.year, make: body.make, model: body.model }, today);
  if (!car.ok) return car;

  const id = parseVehicleId(body.vehicleId, type === "diagnosis");
  if (!id.ok) return id;

  const area = text(body.area, 2, 80);
  if (!area) return { ok: false, error: "Enter your general area, for example Downtown Austin." };
  const address = text(body.address, 3, 200);
  if (!address) return { ok: false, error: "Enter the street address or nearest cross streets." };

  let problem: string;
  if (type === "diagnosis") {
    const description = text(body.description, 3, 300);
    if (!description) return { ok: false, error: "Describe the problem in a few words." };
    const t = body.triage as { likelyCause?: unknown; confidence?: unknown } | undefined;
    const triage =
      t && typeof t.likelyCause === "string" && typeof t.confidence === "string" &&
      ["Low", "Medium", "High"].includes(t.confidence)
        ? { likelyCause: t.likelyCause.slice(0, 300), confidence: t.confidence }
        : null;
    problem = composeProblem({ description, triage });
  } else {
    const notes = body.notes === undefined || body.notes === "" ? "" : text(body.notes, 1, 200);
    if (notes === null) return { ok: false, error: "Notes can be up to 200 characters." };
    const service = findService(serviceId) as NonNullable<ReturnType<typeof findService>>;
    problem = shortServiceName(service) + (notes ? ". " + notes : "");
  }

  return {
    ok: true,
    value: { type, serviceId, ...car.value, vin: id.vin, plate: id.plate, problem, area, address },
  };
}
