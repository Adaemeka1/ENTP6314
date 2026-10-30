// Placeholder money settings. The PRD lists the business model (service fee,
// call-out fee, subscriptions) as an open decision, so change them here only
// and every screen and the server update together.

// What the driver pays for a roadside dispatch, in cents ($107.50).
export const SERVICE_PRICE_CENTS = 10750;

// The share of each job NemaGo keeps. PLACEHOLDER until the PRD's "Service fee
// split" decision is made. It must be more than Stripe's own fee, which comes
// out of NemaGo's share.
export const PLATFORM_FEE_PERCENT = 15;

// Mechanic subscription. This one is still a pretend payment screen.
export const MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH = 20;

export function platformFeeCents(priceCents: number) {
  return Math.round((priceCents * PLATFORM_FEE_PERCENT) / 100);
}

export function mechanicShareCents(priceCents: number, feeCents: number) {
  return priceCents - feeCents;
}

export function formatCents(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export function formatDollars(amount: number) {
  return "$" + amount.toFixed(2);
}
