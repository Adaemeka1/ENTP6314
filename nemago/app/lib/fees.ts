// The pricing engine, from the Discovery Report's unit economics. Change the
// numbers here only and every screen, Stripe's checkout page and the server
// update together. All amounts are in cents.

export const DISPATCH_FEE_LABEL = "NemaGo Platform Dispatch Fee";
export const DIAGNOSTIC_FEE_LABEL = "Conditional Diagnostic Fee";

// NemaGo's fee. It always stays in the NemaGo platform balance once the mechanic
// has recorded a diagnosis ($35.00).
export const DISPATCH_FEE_CENTS = 3500;

// Covers the mechanic's on-site diagnostic labor, or is credited toward the
// repair. It goes to the mechanic once a diagnosis is recorded ($80.00).
export const DIAGNOSTIC_FEE_CENTS = 8000;

// What the driver pays when they confirm: $115.00.
export const SERVICE_PRICE_CENTS = DISPATCH_FEE_CENTS + DIAGNOSTIC_FEE_CENTS;

// Mechanic subscription. This one is still a pretend payment screen.
export const MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH = 20;

// The fee NemaGo keeps. (A fixed amount, not a percentage.)
export function platformFeeCents() {
  return DISPATCH_FEE_CENTS;
}

// What the mechanic receives: the price minus NemaGo's fee ($80.00).
export function mechanicShareCents(priceCents: number, feeCents: number) {
  return priceCents - feeCents;
}

export function formatCents(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export function formatDollars(amount: number) {
  return "$" + amount.toFixed(2);
}
