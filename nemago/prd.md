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

**First cut built (2026-11-20).** The driver can save vehicles (year, make, model and
current mileage; up to 10) at "My vehicles", and report a problem through a guided
screen: a photo drop zone with a framing guide, a warning-light picker, a symptom
picker and a short description. It returns a structured Triage Result: likely cause,
confidence level, safety call (safe to drive / don't drive / move to safety now) and
recommended service, then a "Book Certified Mechanic" button that carries the vehicle
and the triage into the request. What is real and what is not:

- **Demo triage, not a vision model.** No AI provider is connected. The result comes
  from a small fixed set of rules over the chosen warning lights, symptoms and
  description, and is labelled "Demo triage" on screen. Low-confidence results are
  routed to a diagnostic visit instead of a specific repair, as required below.
- **Photos stay on the driver's device.** The photo is only previewed back to the driver
  and is not uploaded, analysed or stored, so no consent flow is needed yet.
- **Vehicle and triage travel as text.** The request has no vehicle column, so the car
  and a one-line triage summary are written into the request description the mechanic
  sees (for example "2018 Honda Civic, 63,500 mi. White smoke under the hood (Triage:
  Coolant leak or overheating, High confidence)"). A proper vehicle link on the request
  is a later step.
- **Not built yet:** VIN scan, engine, voice description, OBD fault codes, and the
  "mileage over time" history (only the current mileage is stored).

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

**Smart Dispatch Match (first cut, built 2026-11-17).** The matching engine is
visible in the product: every eligible mechanic is scored out of 100 on five
weighted factors, and the score is explained on screen. Eligible means verified by
staff (F7) with payouts set up (F5c).

| Factor | Placeholder weight | Based on |
|---|---|---|
| Proximity & live ETA | 30 | Minutes away; once a mechanic accepts, the ETA they commit to |
| ASE skill match | 25 | The mechanic's saved ASE certification against the kind of problem described. Expired certification earns no credit |
| Active shift availability | 20 | Whether the mechanic is on shift now |
| Local parts sourcing readiness | 10 | Whether they carry or can source the likely parts |
| Quality score | 15 | Driver rating and acceptance rate |

- **Real vs. simulated today.** Only the ASE certification and eligibility are real.
  NemaGo has no live location (F4), shift schedule, parts inventory or ratings yet, so
  those four factors use clearly labelled "Demo signals": fixed pseudo-random values
  that stay the same for the same mechanic and job. They must be replaced with real
  data before launch.
- **Where it shows.** The driver sees the ranked candidates while waiting (no names
  or identifiers) and, after a mechanic accepts, that mechanic's breakdown with a line
  like "96% Match, 11 mins away, ASE Certified, Parts Ready". The mechanic sees the
  breakdown on each incoming job card, with the best fit listed first.
- **What it does not do yet.** The score does not decide who is offered a job: every
  eligible mechanic still sees every paid request and the first to accept wins. It
  does not widen the search radius. Scores are calculated each time they are shown and
  are not stored.

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
Approved 2026-10-29. Pricing updated 2026-10-30 to match the Discovery Report's
unit economics. The pilot uses one simple rule: the driver is charged the full
amount when they confirm, and money moves again only on the rules below.

**The price: $115.00 total**, shown to the driver as two lines:

| Line | Amount | What it is |
|---|---|---|
| NemaGo Platform Dispatch Fee | $35.00 | NemaGo's fee for finding and dispatching a mechanic |
| Conditional Diagnostic Fee | $80.00 | Covers the mechanic's on-site diagnostic labor, or is credited toward the repair |

1. **F5a. Driver checkout.** "Confirm Dispatch" creates a request in the
   `awaiting_payment` state and a real Stripe Checkout Session for $115.00 with
   the two fee lines above. The driver is sent to Stripe's hosted, mobile-friendly
   payment page. The price is set on the server, never by the browser. Mechanics
   cannot see the request yet.
2. **F5b. Payment webhook.** A signed Stripe webhook is the only thing that
   marks a request paid. On a successful payment the request moves
   `awaiting_payment` -> `open`, which makes it appear on mechanics' live job
   screens (F3). A payment that arrives for a request that was cancelled, or a
   second payment for the same request, is refunded automatically.
3. **F5c. Mechanic payout setup.** A verified mechanic taps "Set Up Payouts" and
   is sent to Stripe-hosted Express onboarding to link a bank account or debit
   card. A mechanic cannot accept jobs until Stripe says payouts are enabled.
4. **F5d. Diagnostic entry.** After accepting, the mechanic records their
   diagnosis (a short written finding). The request moves `accepted` ->
   `diagnosed`, and the driver sees the diagnosis. This is the point where the
   diagnostic work is considered done.
5. **F5e. Conversion rules.** Once a diagnosis has been recorded, the $115.00 is
   no longer refundable. If the mechanic marks the job **complete**, or the
   driver **cancels**, the result is the same: the **$35.00 dispatch fee stays in
   the NemaGo platform balance** and the **$80.00 diagnostic fee is transferred
   to the mechanic**. A mechanic can only mark a job complete after a diagnosis
   has been recorded.
6. **F5f. Cancellation before diagnostic entry.** If the driver cancels at any
   point before a diagnosis is recorded, they are refunded the full $115.00
   automatically and no mechanic is paid.

**Done means:** a driver can complete a job end-to-end without paying outside
the app, a paid request reaches mechanics only after Stripe confirms the
payment, no request can be charged an amount the server did not set, a request
cancelled before diagnostic entry is refunded without staff action, and after
diagnostic entry the $35.00 stays with NemaGo and the $80.00 reaches the
mechanic without any manual step.

**Update, two-path booking (build steps F5a to F5f above still describe the Stripe
mechanics; the rules below replace the single $115 price and the "diagnosis" refund
cut-off).**

The driver first chooses **How can we help today?**

- **I Know What I Need** (fixed price, no diagnosis fee). The driver enters year, make,
  model and a VIN or license plate first. The vehicle sets a pricing tier: Tier 1 standard
  cars 1.0x, Tier 2 trucks, full-size SUVs and vans 1.25x, Tier 3 luxury and European
  1.5x. Ten services have a base price (oil change $85 up to pre-purchase inspection
  $120); the driver sees "Starting at $XX" before entering a vehicle and base x tier,
  rounded to the nearest $5, after. Checkout itemizes Tiered Labor, NemaGo Sourced Parts
  and the $35 NemaGo Dispatch Fee.
- **Something Is Wrong** (diagnosis). Year, make, model and VIN are required, plus a short
  description or photo. Checkout is the $80 Diagnosis Fee + $35 NemaGo Dispatch Fee = $115.
  The $80 is credited toward the repair if the driver approves the quote afterward.

Both paths are paid in full, up front, before any mechanic is dispatched.

**Parts.** NemaGo centrally sources and buys every part (commercial-grade
OEM/equivalent, matched to the VIN). The warranty is the manufacturer's; NemaGo does not
warranty parts itself. Customers never supply parts and mechanics never
buy parts or wait for reimbursement. After payment the mechanic sees a **Parts Ready for
Pickup** card (store and order number, pre-paid by NemaGo). In this MVP staff enter the
store and order number by hand; there is no store integration yet.

**Money split (`job_transactions`).** `dispatch_fee` 100% NemaGo ($35); `parts_total` 100%
NemaGo; `labor_and_diag_total` 90% to the mechanic's Stripe Connect account and 10% to NemaGo.

**Status flow.** `awaiting_payment` -> `open` -> `accepted` -> `arrived` -> (diagnosis jobs
only) `diagnosed` -> `completed`, or `cancelled`. The cut-off for refunds is now the
mechanic's "I've arrived" tap: cancel before it = full refund including the $35; after it =
no refund. Diagnosis jobs pay the mechanic 90% of the $80 ($72) on arrival; fixed-price jobs
pay 90% of the labor on completion.

**Placeholders to confirm (open decisions):** the split of each service price between parts
and labor (`lib/services.ts` `partsShare`), the make/model lists that decide the tier
(`lib/vehicleTier.ts`), what a mechanic is paid when the driver cancels after arrival on a
fixed-price job (currently 90% of the labor), and how parts are actually bought and
verified.

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
| Vehicles (year, make, model, current mileage; up to 10 per driver. VIN and mileage history come later) | Stored. Visible only to the driver who saved them (Row Level Security). Deleted when the driver removes the car or deletes their account | Pricing, reminders, prediction |
| Symptom photos, descriptions, warning lights | Stored with consent for training; otherwise deleted after job closes. **Today's guided triage does not store or upload photos at all** (the photo stays on the driver's device), and the triage answers are not stored; only the one-line triage summary inside the request description is | Triage and training |
| OBD fault codes | Stored | Triage and training |
| Dispatch request (problem description, general area, street address, status, accepting mechanic's first name and ETA) | Stored. The description is erased when the driver cancels, unless they consent to training use. The street address is visible only to the driver and the mechanic who accepted. No GPS is stored | Matching and job history |
| Job records (diagnosis predicted vs. confirmed, parts, labor time, price quoted vs. final, ratings) | Stored | The flywheel dataset |
| Driver location | Used live during a job; only job address kept afterward | Dispatch and tracking |
| Mechanic profile, documents, background-check result | Stored | Verification and compliance |
| Mechanic phone, certification (name, number, expiry), service area (city, zip, radius) | Stored. Service area is a fixed area, not GPS | Verification and matching |
| Mechanic subscription status and renewal date | Stored (placeholder: the business model is still an open decision) | Platform subscription |
| Mechanic live location | Used live while on shift; not kept afterward | Matching and tracking |
| Mechanic's diagnosis note and when it was recorded | Stored with the job record. Kept when a job is cancelled after diagnostic entry, as the basis for keeping the fee | Job history, fee disputes and the flywheel dataset |
| Payment and payout records (Stripe checkout session, payment, refund and transfer IDs; amounts; payment, refund and payout status) | Stored, in a table only the server can read. IDs only, never card details | Payments, refunds and payouts |
| Mechanic's Stripe account ID and whether payouts are enabled | Stored. Bank and identity details are held by Stripe, not NemaGo | Mechanic payouts |
| Smart Dispatch Match scores and their factor breakdown | **Not stored.** Calculated each time they are shown. Drivers never receive mechanic ids, phone numbers or certification numbers; the accepting mechanic's first name is shown only after they accept | Showing how a match was made |
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
- **Vision provider for photo triage:** which AI provider, what it costs, and the consent
  and storage rules for symptom photos (the PRD requires driver consent before photos are
  kept for training). Adding any AI provider needs the project owner's approval first.
  Until then triage is the labelled demo.
- **Triage thresholds and rules:** how confidence levels are decided, and what accuracy
  the triage must reach before it can quote a specific repair instead of a diagnostic visit.
- **Match weights and rules (placeholders, set 2026-11-17):** the 30 / 25 / 20 / 10 / 15
  split above, how an ASE specialty maps to a type of problem, and whether the score
  should decide who is offered a job (and in what order) or only be shown.
- **Real data for the matching factors:** where live location and ETA (F4), shift
  availability, parts inventory, and ratings and acceptance rate will come from. Until
  then those factors are simulated and labelled as demo signals.
- **Service fee split (decided 2026-10-30, Discovery Report):** a fixed
  $35.00 NemaGo Platform Dispatch Fee and an $80.00 Conditional Diagnostic Fee
  per job, $115.00 in total. Stripe's own processing fee (about 2.9% + 30 cents,
  roughly $3.64 on $115.00) comes out of NemaGo's share, and Stripe does not
  return it on refunds.
- **Refund of the dispatch fee before diagnosis:** the pilot refunds the full
  $115.00 if the driver cancels before a diagnosis is recorded. Whether the $35.00
  dispatch fee should instead be kept once a mechanic has accepted is not decided.
- **Misuse of diagnostic entry:** a mechanic could record a diagnosis without
  doing the work, which would remove the driver's refund. The pilot has no
  safeguard beyond the diagnosis being visible to the driver. Options for later:
  a driver confirmation step, a minimum time on site, or in-app disputes (F5).
- **Repairs beyond the $80.00:** how a repair's own price is quoted, approved
  and paid (PRD F2) is not built. For now the job's only charge is the $115.00.
- **Loss liability:** because NemaGo collects the payment and pays mechanics
  afterward, NemaGo is responsible for losses from refunds and chargebacks that
  happen after a mechanic has been paid (Stripe requires this acknowledgement
  for this payment design). The acknowledgement is accepted in the Stripe test
  account; the business should decide before taking real money how much risk
  to carry, and whether to hold back part of a payout.
- **Payments country and go-live:** payments are built for the US and Stripe
  test mode only. Taking real money needs a separate go-live decision, a
  finished Stripe account activation, and an answer on mechanic classification.

## Next up in class (Session 8, Part 11)

- **Milestone 11a:** Vercel Analytics.
- **Milestone 11f:** email notifications via Resend.

Planned for the next class session. Not started yet.
