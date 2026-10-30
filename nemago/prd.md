# NemaGo — Product Requirements Document (Commercial MVP)

**Status:** Draft v2, rewritten 2026-10-07 after the first spec audit (`strategy/spec-audit-v1.md`).
The previous version of this file described a simulated single-file demo. That
demo still exists as `index.html`, but it is no longer what this document specifies.

## What this is

NemaGo is an **on-demand roadside dispatch platform**. A driver with a car problem
describes the symptom in the app, gets a triaged diagnosis and a transparent,
locked price, is matched to a verified mobile mechanic nearby, tracks them to
the car, and pays in-app when the job is done.

Over time, the repair, mileage and fault-code data from every job trains a
diagnostic and predictive-maintenance engine. That engine makes diagnosis and
pricing more accurate for everyone, and lets NemaGo warn a returning driver
about a likely failure before it strands them.

## The user

Two sides, both of whom must be served for a job to happen.

**Driver (demand side).** A car owner who needs a repair done where the car is.
The research (`research/opportunity-scan.md`) identifies three candidate
groups, and the launch segment is **not yet chosen** (see Open decisions):

1. Stranded drivers mid-breakdown (urgent, low price sensitivity, needs
   minutes-level ETA).
2. Busy drivers who can't get to a shop during business hours (scheduled,
   convenience-led).
3. Drivers who distrust shops and want a price they can hold someone to
   (price- and trust-led).

**Mechanic (supply side).** An independent, certified mobile mechanic who owns
their tools and van and wants a steady flow of pre-priced, pre-diagnosed jobs
without marketing themselves.

## Core user stories

- As a driver, I can describe what's wrong with my car (photo, warning light,
  sound, or OBD fault code), and get a plain-language diagnosis and a locked
  price before I commit.
- As a driver, I can book, track and pay for a verified mechanic in one app,
  and never pay more than the price I approved.
- As a returning driver, I get warned about likely upcoming failures for my
  specific car and mileage, before they happen.
- As a mechanic, I receive jobs near me with the diagnosis, parts list and
  book labor time already attached, and I get paid automatically on completion.

## Features (build in this order)

### F0. Sign-in (foundation for every feature)

Drivers and mechanics sign in with Google or with email and password
(Supabase Auth). New users choose "driver" or "mechanic" at sign-up; Google
users choose right after their first sign-in. Anyone signed out only sees
the sign-in, sign-up and password-reset pages. A mechanic sees a
"verification pending" screen and no jobs until staff mark them verified
(F7). Built in `app/`.

**Done means:** a signed-out visitor to any app page lands on sign-in; a new
driver reaches the driver home; a new mechanic reaches "verification pending"
and cannot change their own verified status.

### F1. Symptom intake and triage

The driver adds their vehicle (VIN scan or year/make/model/engine, plus current
mileage), then describes the problem through any combination of:

- Photos (leak, belt, tire, warning light, damage), analyzed by a
  vision-capable model.
- A short text or voice description.
- Dashboard warning-light picker.
- **Optional:** OBD-II fault codes read from a paired Bluetooth OBD dongle.

Triage returns: the most likely cause(s) with a confidence level, a safety
call (safe to drive / don't drive / move to safety now), and a mapped repair
job (e.g. "replace upper radiator hose"). Low-confidence cases are routed to a
**diagnostic visit** job type instead of a specific repair, so the system never
quotes a repair it can't stand behind.

**Done means:** on a labeled test set of past jobs, the top-1 repair job
matches the mechanic's confirmed repair in at least an agreed share of cases
(target set before launch), and every low-confidence case is routed to a
diagnostic visit rather than a repair quote.

### F2. Transparent, locked pricing

Each repair job is priced from:

- **Labor:** book labor time for that job on that vehicle, from a licensed
  industry repair database (**Mitchell 1** or **ALLDATA**), times NemaGo's
  regional labor rate.
- **Parts:** parts list and price for that vehicle, from the same database
  and/or a parts-supplier catalog.
- **Fees:** a stated call-out fee and NemaGo's service fee, shown as separate
  lines.

The driver sees every line before booking. **The price is locked**: if the
mechanic finds a different problem on site, they must issue a revised quote in
the app, which the driver approves or declines before any extra work. The
driver is never charged above the amount they approved. If the driver declines,
they pay only the call-out/diagnostic fee.

**Done means:** for every job type in the launch catalog, the quote is
generated automatically from database labor times and parts prices with no
manual entry, and no completed job can be charged above the driver's approved
amount.

### F3. Two-sided matching and dispatch

When a driver books, NemaGo offers the job to available mechanics ranked by:
distance/ETA, whether they are certified for that job type, whether they carry
(or can source) the parts, rating, and acceptance history. The first qualified
mechanic to accept gets the job; if nobody accepts within a set window, the
offer widens in radius and the driver is told the new ETA.

Mechanics set their availability, service area and job types in their own app.

**Done means:** a booked job reaches an accepted, qualified mechanic with no
human dispatcher involved, and the driver always sees either an ETA or an
honest "no mechanic available, here's what to do instead" message.

### F4. Live tracking and job status

Real map with the mechanic's live location and ETA, plus job status (en route,
arrived, working, revised quote pending, complete). In-app chat and masked
phone calls between driver and mechanic.

**Done means:** the driver sees the mechanic's real position update in near
real time from acceptance to arrival.

### F5. Integrated payments

- Card authorized (held) at booking for the quoted amount; captured only on
  job completion.
- Revised quotes increase the hold only after driver approval.
- Mechanic payout is automatic, minus NemaGo's commission, via a
  marketplace payments provider (proposed: Stripe Connect).
- Disputes and refunds handled in-app.
- NemaGo never stores raw card numbers; card data stays with the payment
  provider.

**Build steps (Stripe Connect, test mode only until a go-live decision).**
Approved 2026-10-29. The pilot uses one simple rule: the driver is charged when
they confirm, and refunded in full if they cancel before the job is complete.
The hold-then-capture flow above is a later refinement.

1. **F5a. Driver checkout.** "Confirm Dispatch" creates a request in the
   `awaiting_payment` state and a real Stripe Checkout Session for the roadside
   service price (placeholder: $107.50). The driver is sent to Stripe's hosted,
   mobile-friendly payment page. The price is set on the server, never by the
   browser. Mechanics cannot see the request yet.
2. **F5b. Payment webhook.** A signed Stripe webhook is the only thing that
   marks a request paid. On a successful payment the request moves
   `awaiting_payment` -> `open`, which makes it appear on mechanics' live job
   screens (F3). A payment that arrives for a request that was cancelled, or a
   second payment for the same request, is refunded automatically.
3. **F5c. Mechanic payout setup.** A verified mechanic taps "Set Up Payouts" and
   is sent to Stripe-hosted Express onboarding to link a bank account or debit
   card. A mechanic cannot accept jobs until Stripe says payouts are enabled.
4. **F5d. Split payment on completion.** When the mechanic marks the job
   complete, NemaGo transfers the mechanic's share (price minus the NemaGo
   service fee) to their Stripe account. The service fee stays in the NemaGo
   platform balance, which pays out to the NemaGo business bank account. The
   fee percentage is a placeholder (see Open decisions).
5. **F5e. Cancellation refunds.** If the driver cancels after paying and before
   completion, they are refunded in full automatically. No mechanic is paid for
   a cancelled job.

**Done means:** a driver can complete a job end-to-end without paying outside
the app, a paid request reaches mechanics only after Stripe confirms the
payment, no request can be charged an amount the server did not set, a cancelled
paid request is refunded without staff action, and the mechanic is paid without
any manual step.

### F6. Diagnostic and predictive-maintenance engine (foundational)

See "The data flywheel" below. For the MVP, the engine is foundational: it
captures every job's data in a structured form, uses it to improve F1 triage
and F2 pricing accuracy, and gives returning drivers maintenance reminders
based on their car's mileage.

**Done means:** every completed job writes a complete, structured job record
(vehicle, mileage, symptoms, fault codes, predicted diagnosis, confirmed
repair, parts, time taken, final price) to the training dataset, and a
returning driver receives at least mileage-based service reminders for their
vehicle.

### F7. Technician onboarding and verification

See "Technician network" below.

**Done means:** no mechanic can receive a job until every verification step
below is complete and recorded.

## The data flywheel

Each completed job produces a **labeled example**: what the driver reported
(photos, description, warning lights, fault codes), what the triage engine
predicted, and what the mechanic actually found and fixed, on a specific
vehicle at a specific mileage.

That data improves the product in three ways:

1. **Better diagnosis for everyone.** Triage is retrained on confirmed
   outcomes ("this symptom + these fault codes on this engine at this mileage
   was actually X"), so the share of jobs diagnosed correctly before the
   mechanic arrives goes up, and fewer jobs need a diagnostic visit.
2. **More accurate prices.** Comparing quoted vs. actual labor time and parts
   per job type, vehicle and region tightens price estimates and reduces
   revised quotes.
3. **Prediction for each driver.** A driver's own history (mileage logged at
   every job and reminder, past repairs, recurring fault codes), combined with
   failure patterns across all similar vehicles, lets NemaGo predict likely
   upcoming failures ("cars like yours commonly need a water pump at around
   this mileage; yours is close") and offer a scheduled, cheaper repair before
   a breakdown.

**MVP vs. later.** The MVP does not claim learned prediction on day one; there
isn't enough data yet. The MVP version of the engine is:

- **MVP:** structured capture of every job; triage from a general vision/
  language model plus fault-code lookup; mileage-based reminders from
  manufacturer service intervals.
- **After enough jobs:** models trained on NemaGo's own confirmed outcomes for
  triage, pricing and failure prediction. (The job volume needed is an open
  decision.)
- **Later still:** continuous data from a paired OBD dongle (mileage and fault
  codes logged between jobs, with the driver's consent).

## Technician network

### Who qualifies

- Valid ASE certification (or an equivalent recognized certification) for the
  job types they'll accept. Job types are gated by certification.
- Passed criminal background check and driving-record check.
- Proof of identity and right to work.
- Active general liability insurance at a stated minimum (amount to be set).
- Own tools and vehicle suitable for mobile work.

### Onboarding steps

1. Application in the mechanic app (identity, certifications, insurance,
   tools, service area, job types).
2. Automated identity and background checks through a screening provider.
3. Document review of certifications and insurance by NemaGo staff.
4. Skills check: a short practical or video assessment for each job category.
5. First jobs are limited to lower-risk job types until the mechanic has a
   minimum number of completed jobs with good ratings.

### Ongoing quality

- Driver rating after every job.
- Revised-quote rate and comeback rate (same problem within 30 days) tracked
  per mechanic.
- Certifications and insurance re-verified on expiry.
- Mechanics who fall below thresholds are restricted to fewer job types or
  removed.

## Competitive position

Competitors (YourMechanic, Wrench, Spiffy, AutoNation Mobile Service,
ClickMechanic, and roadside programs like AAA) already offer some of this.
The research's main complaint about them is **quotes that rise once the
mechanic is on site**. NemaGo's position against them rests on three things:

1. **Locked prices from industry labor data.** Quotes come from Mitchell 1 /
   ALLDATA labor times, and the driver is never charged above what they
   approved. *Note: these databases are licensed products that competitors
   can also buy. The data on its own is not a moat; the moat is the
   locked-price guarantee built on top of it, plus the corrections from our
   own job data (see flywheel).*
2. **The data flywheel.** NemaGo's confirmed-outcome dataset (predicted vs.
   actual diagnosis, quoted vs. actual time) is collected only through our
   own jobs and can't be bought.
3. **A verified network.** Certification-gated job types and tracked
   comeback rates.

## Integrations and dependencies

| Need | Proposed source | Can a competitor buy it too? |
|---|---|---|
| Labor times, parts, repair procedures | Mitchell 1 or ALLDATA (licensed) | Yes |
| Photo and text diagnosis | A vision-capable model from a commercial AI provider | Yes |
| Fault-code reading | Off-the-shelf Bluetooth OBD-II dongles | Yes |
| Maps, routing, live location | Google Maps Platform or Mapbox | Yes |
| Payments, holds, mechanic payouts | Stripe Connect (or equivalent) | Yes |
| Background and identity checks | A third-party screening provider | Yes |
| Push notifications, masked calls, chat | Standard messaging/telephony providers | Yes |
| Hosting, database | A standard cloud provider | Yes |
| Confirmed job outcomes dataset | Built by NemaGo from its own jobs | **No** |
| Verified mechanic network | Built by NemaGo | Not directly (mechanics can join other platforms too) |

## Data we store

| Data | Kept? | Why |
|---|---|---|
| Driver account (name, phone, email) | Stored | Account and job history |
| Sign-in: role (driver/mechanic), password | Role stored. Password never stored by NemaGo; Supabase Auth keeps only a one-way hash. Google users have no password with us | Sign-in and access |
| Session tokens | In the user's browser cookies only; deleted on sign-out | Keeping people signed in |
| Vehicles (VIN, year/make/model, mileage over time) | Stored | Pricing, reminders, prediction |
| Symptom photos, descriptions, warning lights | Stored with consent for training; otherwise deleted after job closes | Triage and training |
| OBD fault codes | Stored | Triage and training |
| Dispatch request (problem description, general area, street address, status, accepting mechanic's first name and ETA) | Stored. The description is erased when the driver cancels, unless they consent to training use. The street address is visible only to the driver and the mechanic who accepted. No GPS is stored | Matching and job history |
| Job records (diagnosis predicted vs. confirmed, parts, labor time, price quoted vs. final, ratings) | Stored | The flywheel dataset |
| Driver location | Used live during a job; only job address kept afterward | Dispatch and tracking |
| Mechanic profile, documents, background-check result | Stored | Verification and compliance |
| Mechanic phone, certification (name, number, expiry), service area (city, zip, radius) | Stored. Service area is a fixed area, not GPS | Verification and matching |
| Mechanic subscription status and renewal date | Stored (placeholder: the business model is still an open decision) | Platform subscription |
| Mechanic live location | Used live while on shift; not kept afterward | Matching and tracking |
| Payment and payout records (Stripe checkout session, payment, refund and transfer IDs; amounts; payment, refund and payout status) | Stored, in a table only the server can read. IDs only, never card details | Payments, refunds and payouts |
| Mechanic's Stripe account ID and whether payouts are enabled | Stored. Bank and identity details are held by Stripe, not NemaGo | Mechanic payouts |
| Card numbers | **Not stored** — held by the payment provider | Payments |

Drivers can export or delete their data. Training uses job data with personal
identifiers removed.

## Out of scope for the MVP

- Towing (NemaGo dispatches mobile repairs only; jobs that need a tow are
  referred out).
- Jobs that need a lift or a shop (e.g. transmission rebuilds); the catalog is
  limited to jobs a mobile mechanic can do on site.
- Fleet and business accounts.
- Insurance and warranty claims handling.
- Continuous OBD telematics between jobs (later phase of the flywheel).
- Electric-vehicle high-voltage repairs.
- Markets outside the launch city.

## Success metrics

- Share of jobs where the triage diagnosis matched the confirmed repair
  (should rise over time; this is the flywheel working).
- Share of jobs with a revised quote, and average revised-quote increase.
- Time from booking to mechanic arrival.
- Share of booking requests that found a mechanic.
- Comeback rate (same problem within 30 days).
- Repeat-driver rate, and share of repeat jobs started from a predictive
  reminder.

## Open decisions

These are not yet answered and need a team decision:

- **Launch segment:** stranded, busy, or shop-distrustful drivers (each
  changes the job catalog, ETA promise and pricing).
- **Launch geography:** which city.
- **Who pays:** the driver only, or also insurers, roadside programs, or
  employers.
- **Business model:** commission rate, call-out fee, and whether there is a
  driver subscription.
- **Mechanic classification:** independent contractors or employees (this has
  legal consequences that vary by state).
- **Database choice and cost:** Mitchell 1 vs. ALLDATA, licensing terms, and
  whether either permits use in a consumer-facing pricing product.
- **Data volume** needed before NemaGo-trained models replace the general model.
- **Price guarantee backstop:** who absorbs the cost when a job takes longer
  than book time (mechanic, NemaGo, or split).
- **Insurance minimums** for mechanics, and NemaGo's own liability cover.
- **Service fee split:** the percentage of each job NemaGo keeps. The app uses a
  clearly labeled placeholder (15%) until this is decided. It must cover
  Stripe's own processing fee, which comes out of NemaGo's share.
- **Cancellation policy:** the pilot refunds drivers in full if they cancel at
  any point before the job is complete. Whether a late cancellation costs a
  call-out fee is not decided.
- **Payments country and go-live:** payments are built for the US and Stripe
  test mode only. Taking real money needs a separate go-live decision, a
  finished Stripe account activation, and an answer on mechanic classification.

## Next up in class (Session 8, Part 11)

- **Milestone 11a:** Vercel Analytics.
- **Milestone 11f:** email notifications via Resend.

Planned for the next class session. Not started yet.
