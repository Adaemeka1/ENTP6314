// Placeholder prices. The PRD lists the business model (call-out fee,
// commission, subscriptions) as an open decision, so change them here only
// and every screen updates.
export const DISPATCH_FEE_DOLLARS = 35;
export const MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH = 20;

export function formatDollars(amount: number) {
  return "$" + amount.toFixed(2);
}
