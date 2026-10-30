# nemago

Working rules for this subfolder. See [prd.md](prd.md) for the product spec.
This file applies only within `nemago/` and does not override or replace the
root [`../CLAUDE.md`](../CLAUDE.md), which still governs the unrelated
`Session2_BadPrompt` / `Session2_DetailedPrompt` comparison project.

## What this folder is

- `prd.md`: the spec for NemaGo as a **commercial MVP**, an on-demand
  roadside dispatch platform with real triage, matching, pricing, payments and
  a predictive-maintenance engine. This is the source of truth for scope.
- `index.html`: the **original clickable prototype**, a single-file simulated
  demo with mocked diagnosis, pricing, matching and tracking. It predates the
  MVP spec and does not implement it. It is deployed to Vercel from this
  folder (`.vercel/`).
- `app/`: the **MVP app** (Next.js + Supabase Auth, approved 2026-10-21).
  So far it has sign-in (F0), driver/mechanic tables, a simulated payment
  screen and a keyword-based Car Helper chat (these are demos, not the real
  F1/F5 features), plus a first cut of F3 dispatch: live driver requests and
  mechanic accept (Supabase Realtime), and Stripe Connect payments (F5a to F5e
  in the PRD). Setup steps are in `app/README.md`.
- `research/`: market and competitor research.
- `strategy/`: spec audits (`spec-audit.md` is current; `spec-audit-v1.md`
  audited the earlier prototype PRD).

## The prototype (`index.html`)

If asked to change the prototype, keep its original constraints: one file
with inline CSS and JS, no dependencies, no network calls, everything mocked
client-side. Do not grow it into the MVP piece by piece.

## Building the MVP

- **Stack:** Next.js (App Router) + Supabase (Auth and Postgres), hosted
  on Vercel, plus **Stripe Connect** for payments (approved 2026-10-29, test
  mode only). MVP code lives in `app/`, not in `index.html`. Adding another
  major service or framework still needs explicit approval first.
- **Auth rules:** check sign-in on the server with `supabase.auth.getUser()`.
  Protect data with Row Level Security; users must never be able to set
  their own `mechanic_verified`. Database changes go in `app/supabase/`.
- **`app/` is not part of the prototype deploy.** `.vercelignore` keeps it
  out of `npx vercel --prod` runs from this folder; the app gets its own
  Vercel project.
- **Build in the PRD's feature order (F0 to F7)**, one feature at a time, and
  check each against its "Done means" line before moving on.
- **Don't build anything on the PRD's "Out of scope for the MVP" list**, even
  if it would be easy. Treat a request for one of those items as a scope
  change and confirm it first.
- **Don't silently settle an "Open decision".** If work depends on one (launch
  segment, city, fees, Mitchell 1 vs. ALLDATA, contractor vs. employee, etc.),
  ask, or make it a clearly labeled config value with a placeholder.

## Integrations and secrets

- Use sandbox or test credentials only (Stripe test mode, provider sandboxes).
  Never use live keys during development.
- Never commit API keys, tokens or credentials. Keep them in environment
  variables or an untracked local env file, and add it to `.gitignore`.
- Mitchell 1 / ALLDATA data is licensed: don't commit copies of their data
  into the repo, and don't call them until the licence question in the PRD
  is resolved.

### Stripe Connect (payments)

Test mode only (`sk_test_...`). Never use live keys, and never put any key in
chat, in the repo, or in `.env.example` (placeholders only). Real values live in
Vercel's Environment Variables (and an untracked `app/.env.local` for local runs).

Environment variables (all server-side secrets except the site URL):

| Variable | What it is | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe test secret key, `sk_test_...` | Stripe Dashboard -> Developers -> API keys |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for our webhook endpoint, `whsec_...` | Stripe Dashboard -> Developers -> Webhooks -> the endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key. Bypasses all security rules. Server routes only, never `NEXT_PUBLIC_`, never in client code | Supabase -> Project Settings -> API keys |
| `NEXT_PUBLIC_SITE_URL` | Public address of the app, e.g. `https://nemago-app.vercel.app`. Used for Stripe return links | Vercel project URL |

Backend API routes (all in `app/app/api/`, all server-only):

| Path | Who calls it | What it does |
|---|---|---|
| `POST /api/checkout` | Driver | Creates the request (`awaiting_payment`) and a Stripe Checkout Session; returns the Stripe URL |
| `POST /api/stripe/webhook` | Stripe only (no sign-in; verified by signature) | `checkout.session.completed` -> request becomes `open`; `checkout.session.expired` -> cancelled; refunds stray payments |
| `POST /api/stripe/connect/onboard` | Verified mechanic | Creates the Express account if needed and returns the onboarding link ("Set Up Payouts") |
| `POST /api/stripe/connect/status` | Mechanic | Asks Stripe if payouts are enabled and saves the answer |
| `POST /api/dispatch/complete` | Accepting mechanic | Marks the job complete and sends the mechanic's share via a Stripe transfer |
| `POST /api/dispatch/cancel` | Driver | Cancels the request and refunds in full if it was paid |

Shared server code: `app/lib/stripe.ts` (Stripe client, site URL),
`app/lib/supabase/admin.ts` (service-role client), `app/lib/fees.ts` (price and
service-fee placeholders). Database changes: `app/supabase/payments.sql`.

Money rules:

- **Amounts are decided on the server** (`lib/fees.ts`), never taken from the
  browser. The webhook checks the paid amount against the saved price.
- **Only the signed webhook marks a request paid.** The success page the driver
  lands on after Stripe is just a message. The webhook route must read the raw
  request body, and `/api/stripe/webhook` must stay public in
  `lib/supabase/middleware.ts` (Stripe has no sign-in cookie).
- **Request status flow:** `awaiting_payment` -> `open` (paid, visible to
  mechanics) -> `accepted` -> `completed`; or `cancelled`. Not `searching` or
  `matched`: "matched" means a mechanic accepted.
- **Separate charges and transfers:** the driver pays NemaGo's platform account;
  on completion NemaGo transfers the mechanic's share. NemaGo's fee stays in the
  platform balance. Use idempotency keys on every Stripe write so retries never
  pay or refund twice.
- Stripe IDs live in `dispatch_payments`, which only the server (service role)
  can read. Never store card details.
- The service-fee percentage and the US country code are labeled placeholders
  (open decisions in the PRD). Don't treat them as final.

## Data handling

Follow the PRD's "Data we store" table exactly:

- Never store card numbers; card data stays with the payment provider.
- Live driver and mechanic locations are used live only, not persisted
  (keep the job address only).
- Symptom photos and descriptions are kept for training only with the
  driver's consent; otherwise delete them when the job closes.
- Training data has personal identifiers removed.
- Support driver data export and deletion.

If a feature needs to keep data the table doesn't list, flag it and update
the PRD before building it.

## Next up in class (Session 8, Part 11)

We plan to tackle these two milestones next, in the room walkthrough:

- **Milestone 11a:** add Vercel Analytics.
- **Milestone 11f:** add email notifications with Resend (test API key only, kept in an env variable, never committed).

Not started yet. Don't build either one until we start it in class.
