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
  mechanic accept (Supabase Realtime). Setup steps are in `app/README.md`.
- `research/`: market and competitor research.
- `strategy/`: spec audits (`spec-audit.md` is current; `spec-audit-v1.md`
  audited the earlier prototype PRD).

## The prototype (`index.html`)

If asked to change the prototype, keep its original constraints: one file
with inline CSS and JS, no dependencies, no network calls, everything mocked
client-side. Do not grow it into the MVP piece by piece.

## Building the MVP

- **Stack:** Next.js (App Router) + Supabase (Auth and Postgres), hosted
  on Vercel. MVP code lives in `app/`, not in `index.html`. Adding another
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
