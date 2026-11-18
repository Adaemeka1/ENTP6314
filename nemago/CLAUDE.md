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
  PRD), a visible Smart Dispatch Match (F3 first cut), and an F1 first cut: saved
  vehicles and a guided demo triage. Setup steps are in `app/README.md`.
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
| `POST /api/checkout` | Driver | Validates a booking (fixed-price or diagnosis, with the vehicle), creates the request (`awaiting_payment`) and a Stripe Checkout Session priced on the server; returns the Stripe URL. `{requestId}` alone resumes payment for an unpaid request |
| `POST /api/stripe/webhook` | Stripe only (no sign-in; verified by signature) | `checkout.session.completed` -> request becomes `open`; `checkout.session.expired` -> cancelled; refunds stray payments |
| `POST /api/stripe/connect/onboard` | Verified mechanic | Creates the mechanic's Stripe account if needed (Accounts v2: Express dashboard, recipient config, NemaGo collects fees and losses) and returns the onboarding link ("Set Up Payouts") |
| `POST /api/stripe/connect/status` | Mechanic | Asks Stripe if payouts are enabled and saves the answer |
| `POST /api/dispatch/arrive` | Accepting mechanic | "I've arrived". Ends the driver's refund window. Diagnosis jobs: pays the mechanic 90% of the $80 now. Safe to repeat (never pays twice) |
| `POST /api/dispatch/complete` | Accepting mechanic | Completes the job (diagnosis jobs: after the diagnosis note; fixed-price jobs: after arriving) and pays 90% of the labor via a Stripe transfer. Also retries a failed payout |
| `POST /api/match` | Driver (own request only) | Read-only. Scores and ranks eligible mechanics (waiting: top 3, no names; accepted: that mechanic's breakdown). Returns 503 `match_unavailable` if `match.sql` has not been run, and the screen then hides the panel |
| `POST /api/triage` | Driver | Read-only. Validates the picked warning lights, symptoms and description and returns the **demo** triage result (cause, confidence, safety call, service). No AI provider, no photos, no database writes |
| `POST /api/dispatch/cancel` | Driver | Cancels the request. Before the mechanic arrives: full refund. After arrival: no refund, the mechanic is paid their 90% |

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
  mechanics) -> `accepted` -> `arrived` (mechanic tapped "I've arrived") ->
  `diagnosed` (diagnosis jobs only) -> `completed`; or `cancelled`. Not `searching` or `matched`: "matched" means a
  mechanic accepted.
- **Prices** (constants in `lib/fees.ts`, calculation in `lib/pricing.ts`): a diagnosis
  booking is $115.00 = $35.00 NemaGo Dispatch Fee + $80.00 Diagnosis Fee; a fixed-price
  booking is tiered labor + NemaGo-sourced parts + the $35.00 dispatch fee. Cancel before the
  mechanic taps "I've arrived" -> full refund (including the $35). After arrival there is no
  refund: the $35 and the parts stay with NemaGo and the mechanic is paid 90% of the labor /
  diagnosis bucket (diagnosis jobs: $72 on arrival; fixed-price jobs: on completion, or on a
  cancel after arrival). Completion is only allowed from `diagnosed` (diagnosis jobs) or
  `arrived` (fixed-price jobs). These rules live in `admin_begin_arrival`,
  `admin_begin_cancel` and `admin_begin_completion` in `app/supabase/booking.sql`
  (which supersedes `pricing-diagnostic.sql`'s versions).
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

### Two-path booking, vehicle tiers and parts (update after F5)

- **Run `app/supabase/booking.sql` before deploying this update.** Without it the booking
  screens fail.
- **Pages:** `/driver/request` (chooser "How can we help today?" + live status),
  `/driver/book/service` (I Know What I Need) and `/driver/book/diagnosis` (Something Is Wrong).
  Code: `lib/vehicleTier.ts` (tier from make/model, placeholder lists), `lib/services.ts`
  (10 services; `partsShare` is a PLACEHOLDER split of price into parts and labor),
  `lib/pricing.ts` (`priceBooking`, `tieredPriceDollars` = base x tier rounded to the nearest
  $5, `MECHANIC_PERCENT` = 90), `lib/booking.ts` (validation, shared by browser and server),
  `components/booking/*`.
- **Prices are always recomputed on the server** from the service id and the vehicle. The
  browser's amounts are ignored.
- **Money buckets** live in `job_transactions`: `dispatch_fee` ($35, 100% NemaGo),
  `parts_total` (100% NemaGo), `labor_and_diag_total` (90% mechanic, 10% NemaGo). The old
  `platform_fee_cents` column still equals price minus the mechanic's payout, so
  `lib/payout.ts` is unchanged.
- **Parts policy:** NemaGo buys and warrants all parts. No customer-supplied parts, no mechanic
  reimbursement. The policy text (`PartsTrustBadge`) must appear on every checkout screen.
  Store and order number in `parts_orders` are entered by staff via SQL until a real store
  integration exists. Never invent them.
- **Refund cut-off** is the "I've arrived" tap (`/api/dispatch/arrive`), not the diagnosis note.

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

### Vehicles and guided triage (PRD F1)

- **Pages:** `/driver/vehicles` (add, view, update mileage, remove) and `/driver/triage`
  (guided intake and result). Code: `lib/vehicles.ts` and `lib/triage.ts` (pure, no
  imports), `components/VehicleManager.tsx`, `TriageFlow.tsx`, `TriageResultCard.tsx`,
  `PhotoDropZone.tsx`, `app/api/triage/route.ts`. Database: `app/supabase/vehicles.sql`.
- **`vehicles` table:** drivers read, add, edit (year, make, model, mileage only) and delete
  only their own rows through Row Level Security, up to 10 each. Mechanics and the server
  key cannot read it. The driver's browser talks to it directly with their own sign-in.
- **The triage is a DEMO.** `lib/triage.ts` is rules, not an AI vision model, and every
  result must stay labelled "Demo triage". **Do not add an AI/vision provider or key without
  the owner's explicit approval** (new major service). When one is approved it plugs in
  behind `/api/triage` with the same request and response shape.
- **Photos never leave the device.** `PhotoDropZone` only previews the file. Do not upload
  or store photos until a consent and storage flow exists (see the PRD data table).
- **The handoff to a request** goes through `sessionStorage` (`nemago.triage`, expires in an
  hour), never the URL, so no symptom text ends up in an address. The request screen then
  writes the car and a one-line triage into the request description with `composeProblem`
  (max 500 characters). `/api/checkout`, the webhook and every money rule are unchanged:
  the vehicle is only text in the existing description, not a new column.
- Triage must route low-confidence results to a **diagnostic visit**, never a specific
  repair (PRD F1).

## Design system

One stylesheet, `app/app/globals.css`, for every screen. Calm, high-trust, readable
in bright outdoor glare: deep slate navy `#0F172A` (header, headings, text),
soft off-white cards `#F8FAFC` with 2px borders, emerald badges for "Verified" and
"Price locked", sky blue `#38BDF8` for the main action. **There is no orange anywhere in the
app** (owner's rule since the two-path booking update; the four `--action*` tokens at the top
of the stylesheet are the only place to change the action colour). **Action buttons use navy
text on sky blue** (about 8:1 contrast). Base text is 17px, tap
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
