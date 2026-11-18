// The pricing engine for both booking paths. The SERVER uses this to set every
// price; the screens use the same functions to show it. All amounts in cents.
//
// Every job is split into three buckets (the `job_transactions` table):
//   dispatch_fee         100% NemaGo   (the $35 dispatch fee)
//   parts_total          100% NemaGo   (wholesale part cost + NemaGo's parts margin)
//   labor_and_diag_total 90% to the mechanic's Stripe account, 10% NemaGo
//
// Path A (fixed price): total = tiered service price + $35 dispatch fee.
//   The tiered service price is the base price x the vehicle tier, rounded to the
//   nearest $5, and it already includes the parts and the labor.
// Path B (diagnosis): total = $80 diagnosis fee + $35 dispatch fee = $115.

import { DIAGNOSTIC_FEE_CENTS, DISPATCH_FEE_CENTS } from "./fees";
import { findService, type Service } from "./services";
import { classifyTier, type TierInfo } from "./vehicleTier";

// The mechanic's share of the labor / diagnosis bucket. The database holds the
// same number (mechanic_percent() in booking.sql) and is the one that actually
// decides payouts; this copy is for showing prices and for tests.
export const MECHANIC_PERCENT = 90;

// Base price x tier multiplier, rounded to the nearest $5 (whole dollars out).
export function tieredPriceDollars(baseDollars: number, multiplierPct: number) {
  return Math.round((baseDollars * multiplierPct) / 500) * 5;
}

// What the mechanic receives from the labor / diagnosis bucket.
export function mechanicPayoutCents(laborAndDiagCents: number) {
  return Math.floor((laborAndDiagCents * MECHANIC_PERCENT + 50) / 100);
}

export type Priced = {
  type: "diagnosis" | "fixed_price";
  service: Service | null;
  tier: TierInfo | null;
  // The three buckets.
  dispatchFeeCents: number;
  partsCents: number;
  laborAndDiagCents: number;
  totalCents: number;
  // How the labor / diagnosis bucket is shared.
  mechanicPayoutCents: number;
  nemagoLaborCutCents: number;
  // Everything NemaGo keeps: the dispatch fee, the parts and its labor cut.
  nemagoKeepsCents: number;
};

function assemble(
  type: Priced["type"],
  service: Service | null,
  tier: TierInfo | null,
  partsCents: number,
  laborAndDiagCents: number,
): Priced {
  const dispatchFeeCents = DISPATCH_FEE_CENTS;
  const totalCents = dispatchFeeCents + partsCents + laborAndDiagCents;
  const mechanic = mechanicPayoutCents(laborAndDiagCents);
  return {
    type,
    service,
    tier,
    dispatchFeeCents,
    partsCents,
    laborAndDiagCents,
    totalCents,
    mechanicPayoutCents: mechanic,
    nemagoLaborCutCents: laborAndDiagCents - mechanic,
    nemagoKeepsCents: totalCents - mechanic,
  };
}

export type PriceInput =
  | { type: "diagnosis" }
  | { type: "fixed_price"; serviceId: string; vehicle: { make: string; model: string } };

// Returns null if the service doesn't exist.
export function priceBooking(input: PriceInput): Priced | null {
  if (input.type === "diagnosis") {
    return assemble("diagnosis", null, null, 0, DIAGNOSTIC_FEE_CENTS);
  }
  const service = findService(input.serviceId);
  if (!service) return null;
  const tier = classifyTier(input.vehicle);
  const serviceCents = tieredPriceDollars(service.baseDollars, tier.multiplierPct) * 100;
  // Whole dollars of parts; the rest of the price is labor.
  const partsCents = Math.round((serviceCents / 100) * service.partsShare) * 100;
  return assemble("fixed_price", service, tier, partsCents, serviceCents - partsCents);
}

// "Starting at $85": the Tier 1 price, before a vehicle is entered.
export function startingAtDollars(service: Service) {
  return tieredPriceDollars(service.baseDollars, 100);
}
