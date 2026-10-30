import Stripe from "stripe";

// Placeholder: payments are built for the US only (see the PRD's open decisions).
export const CONNECT_COUNTRY = "US";

// Stripe client for server code only. Returns null if the key isn't set up.
// Test mode only: a live key is refused on purpose until there is a go-live decision.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    console.error("STRIPE_SECRET_KEY is not a test-mode key. Refusing to use it.");
    return null;
  }
  return new Stripe(key);
}

// The public address of the app, used for the links Stripe sends people back to.
export function siteUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return (configured || new URL(request.url).origin).replace(/\/+$/, "");
}
