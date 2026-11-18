// Fee constants. Booking prices are worked out in lib/pricing.ts. Change numbers
// here and every screen, Stripe's checkout page and the server update together.
// All amounts are in cents.

export const DISPATCH_FEE_LABEL = "NemaGo Dispatch Fee";
export const DIAGNOSTIC_FEE_LABEL = "Diagnosis Fee";

// NemaGo's dispatch fee ($35.00). 100% NemaGo's.
export const DISPATCH_FEE_CENTS = 3500;

// The diagnosis fee for a "Something Is Wrong" booking ($80.00). It is part of
// the labor / diagnosis bucket: 90% goes to the mechanic and 10% to NemaGo.
export const DIAGNOSTIC_FEE_CENTS = 8000;

// What a diagnosis booking costs: $115.00. (Fixed-price bookings are priced in
// lib/pricing.ts.)
export const SERVICE_PRICE_CENTS = DISPATCH_FEE_CENTS + DIAGNOSTIC_FEE_CENTS;

// Mechanic subscription. This one is still a pretend payment screen.
export const MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH = 20;

// What NemaGo keeps of a job = the price minus the mechanic's payout. The
// database stores this as `platform_fee_cents`, so the mechanic's payout is
// always price - platform fee.
export function mechanicShareCents(priceCents: number, feeCents: number) {
  return priceCents - feeCents;
}

export function formatCents(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export function formatDollars(amount: number) {
  return "$" + amount.toFixed(2);
}
