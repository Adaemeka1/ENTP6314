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
  mechanic accept (Supabase Realtime), Stripe Connect payments (F5a to F5f in the
  PRD), and a visible Smart Dispatch Match (F3 first cut). Setup steps are in
  `app/README.md`.
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
| `POST /api/stripe/connect/onboard` | Verified mechanic | Creates the mechanic's Stripe account if needed (Accounts v2: Express dashboard, recipient config, NemaGo collects fees and losses) and returns the onboarding link ("Set Up Payouts") |
| `POST /api/stripe/connect/status` | Mechanic | Asks Stripe if payouts are enabled and saves the answer |
| `POST /api/dispatch/complete` | Accepting mechanic | After a diagnosis is recorded: marks the job complete and sends the mechanic's $80 via a Stripe transfer. Also retries a failed payout |
| `POST /api/match` | Driver (own request only) | Read-only. Scores and ranks eligible mechanics (waiting: top 3, no names; accepted: that mechanic's breakdown). Returns 503 `match_unavailable` if `match.sql` has not been run, and the screen then hides the panel |
| `POST /api/dispatch/cancel` | Driver | Cancels the request. Before diagnosis: full refund. After diagnosis: no refund, the mechanic is paid the $80 |

Shared server code: `app/lib/stripe.ts` (Stripe client, site URL),
`app/lib/supabase/admin.ts` (service-role client), `app/lib/fees.ts` (the $35 / $80 / $115
price). Database changes: `app/supabase/payments.sql`.

Money rules:

- **Amounts are decided on the server** (`lib/fees.ts`), never taken from the
  browser. The webhook checks the paid amount against the saved price.
- **Only the signed webhook marks a request paid.** The success page the driver
  lands on after Stripe is just a message. The webhook route must read the raw
  request body, and `/api/stripe/webhook` must stay public in
  `lib/supabase/middleware.ts` (Stripe has no sign-in cookie).
- **Request status flow:** `awaiting_payment` -> `open` (paid, visible to
  mechanics) -> `accepted` -> `diagnosed` (mechanic recorded a diagnosis) ->
  `completed`; or `cancelled`. Not `searching` or `matched`: "matched" means a
  mechanic accepted.
- **Price: $115.00 = $35.00 NemaGo Platform Dispatch Fee + $80.00 Conditional
  Diagnostic Fee** (from the Discovery Report; constants in `lib/fees.ts`). Cancel
  before `diagnosed` -> full refund. At `diagnosed`, whether the mechanic marks it
  complete or the driver cancels: $35 stays in NemaGo's balance and $80 is
  transferred to the mechanic, no refund. Completion is only allowed from
  `diagnosed`. These rules live in the `admin_begin_cancel` and
  `admin_begin_completion` functions in `app/supabase/pricing-diagnostic.sql`.
- **Separate charges and transfers:** the driver pays NemaGo's platform account;
  on completion NemaGo transfers the mechanic's share. NemaGo's fee stays in the
  platform balance. Use idempotency keys on every Stripe write so retries never
  pay or refund twice.
- Stripe IDs live in `dispatch_payments`, which only the server (service role)
  can read. Never store card details.
- **Accounts v2 only.** Stripe rejects the old `accounts.create({ type: "express" })`
  for new platforms, so mechanic accounts use `stripe.v2.core.accounts` and
  `stripe.v2.core.accountLinks`. Because the driver pays NemaGo first and the
  mechanic is paid later (separate charges and transfers), Stripe only allows
  NemaGo as the losses collector. This needs the "Refunds and chargebacks
  liability acknowledgement" accepted once in Stripe (Settings -> Connect ->
  Platform profile). "Managed Risk" (Stripe collects losses) does not work for
  this flow.
- The US country code is a labeled placeholder (open decision in the PRD). The
  $35 / $80 split is decided; open items are listed in the PRD.

### Smart Dispatch Match (PRD F3)

- **Code:** `app/lib/match.ts` (pure scoring, no imports, used in the browser and on the
  server), `app/components/MatchBreakdown.tsx` and `MatchPanel.tsx` (display),
  `app/app/api/match/route.ts` (driver's ranking), `app/supabase/match.sql`
  (`admin_match_candidates()`, service-role only).
- **Five weighted factors:** proximity & live ETA 30, ASE skill match 25, shift
  availability 20, parts readiness 10, quality 15. These weights are **placeholders**
  (PRD open decision) and must always add up to 100.
- **Real vs. demo:** only ASE certification and eligibility (verified + payouts
  enabled) are real. ETA, shift, parts, rating and acceptance rate are simulated by
  `demoSignals()` and must stay labelled "Demo signals" on screen until real data
  exists. Do not present them as real.
- **Privacy:** never send a driver's browser a mechanic's id, phone, certification
  number or last name. Before acceptance mechanics are "Mechanic 1, 2, 3"; after,
  only the first name. Scores are calculated on demand and not stored.
- The match is **display-only**: it must not change who can see or accept a job, or
  touch any price, payment or payout.

## Design system

One stylesheet, `app/app/globals.css`, for every screen. Calm, high-trust, readable
in bright outdoor glare: deep slate navy `#0F172A` (header, headings, text),
soft off-white cards `#F8FAFC` with 2px borders, emerald badges for "Verified" and
"Price locked", amber `#F97316` for the main action. **Action buttons use navy text
on amber** (white on that orange fails contrast in sunlight). Base text is 17px, tap
targets are at least 54px, and colour pairs must keep WCAG AA contrast. Components rely
on the class names in this file, so change styles in the stylesheet and rename
classes only with the components. Stripe's payment page is Stripe's own and cannot be
restyled.

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
