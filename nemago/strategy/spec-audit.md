# NemaGo: Spec Audit (v2)

**Sources read:** `nemago/prd.md` (Draft v2, the commercial MVP spec) and `nemago/research/opportunity-scan.md` (competitor and market research).
**Date:** 2026-10-07
**Previous audit:** `strategy/spec-audit-v1.md`, which covered the earlier prototype version of the PRD.

This audit only describes what `prd.md` commits us to. It gives no advice. Text in quotation marks comes from `prd.md` unless it says otherwise. **[INFERRED]** marks anything I worked out myself rather than read in the PRD.

**Compared with v1:** the PRD now has a user section, a "Done means" line for every feature, a DATA WE STORE table, a dependencies table, an out-of-scope list, and an "Open decisions" list. The v1 audit could not answer most of its questions at all. This one can answer all six, though each answer still has holes, listed under GAPS.

---

## 1. THE USER

**What `prd.md` says:**

> "Two sides, both of whom must be served for a job to happen."

> "**Driver (demand side).** A car owner who needs a repair done where the car is."

> "the launch segment is **not yet chosen**"

> "**Mechanic (supply side).** An independent, certified mobile mechanic who owns their tools and van and wants a steady flow of pre-priced, pre-diagnosed jobs without marketing themselves."

**Driver: one group or a broad category?** A broad category. The PRD itself splits it into three groups and says they behave differently:

1. "Stranded drivers mid-breakdown (urgent, low price sensitivity, needs minutes-level ETA)."
2. "Busy drivers who can't get to a shop during business hours (scheduled, convenience-led)."
3. "Drivers who distrust shops and want a price they can hold someone to (price- and trust-led)."

It also says the choice matters: each segment "changes the job catalog, ETA promise and pricing" (Open decisions).

**Mechanic: one group or a broad category?** Closer to one identifiable group: independent, certified, mobile, with their own tools and van. **[INFERRED]** Two things still blur it. "Certified" is defined later as "ASE certification (or an equivalent recognized certification)," which leaves "equivalent" undefined. And whether these people are contractors or employees is an open decision ("Mechanic classification: independent contractors or employees"), even though the definition says "independent."

---

## 2. WHERE THE WORK HAPPENS

### F1. Symptom intake and triage

> **Done means:** "on a labeled test set of past jobs, the top-1 repair job matches the mechanic's confirmed repair in at least an agreed share of cases (target set before launch), and every low-confidence case is routed to a diagnostic visit rather than a repair quote."

| | |
|---|---|
| **What the product does** | Decodes the vehicle from "VIN scan or year/make/model/engine." Analyzes photos "by a vision-capable model." Returns "the most likely cause(s) with a confidence level, a safety call … and a mapped repair job." Routes "Low-confidence cases" to "a **diagnostic visit** job type." |
| **What the user still does** | The driver enters the vehicle and "current mileage," takes the photos, and writes or speaks the description. For OBD codes, the driver needs "a paired Bluetooth OBD dongle"; the PRD does not say who supplies it, so **[INFERRED]** the driver buys and pairs one separately. The real diagnosis is still made by the mechanic on site. The Done-means line measures the app against "the mechanic's confirmed repair." |
| **Note** | The accuracy target in the Done-means line is not set: "an agreed share of cases (target set before launch)." |

### F2. Transparent, locked pricing

> **Done means:** "for every job type in the launch catalog, the quote is generated automatically from database labor times and parts prices with no manual entry, and no completed job can be charged above the driver's approved amount."

| | |
|---|---|
| **What the product does** | Builds the quote from "book labor time … from a licensed industry repair database (**Mitchell 1** or **ALLDATA**), times NemaGo's regional labor rate," plus parts and fees. Shows every line. Locks the price and enforces the cap. |
| **What the user still does** | When the job differs, "the mechanic … must issue a revised quote in the app, which the driver approves or declines." **[INFERRED]** The mechanic writes that revised quote by hand; the PRD does not say it is generated automatically. Buying the parts happens outside the product: F3 ranks mechanics on whether they "carry (or can source) the parts," so **[INFERRED]** the mechanic buys and brings them. |

### F3. Two-sided matching and dispatch

> **Done means:** "a booked job reaches an accepted, qualified mechanic with no human dispatcher involved, and the driver always sees either an ETA or an honest 'no mechanic available, here's what to do instead' message."

| | |
|---|---|
| **What the product does** | Offers the job to mechanics "ranked by: distance/ETA, whether they are certified for that job type, whether they carry (or can source) the parts, rating, and acceptance history," and widens the radius if nobody accepts. |
| **What the user still does** | The mechanic sets "availability, service area and job types" and accepts or ignores offers. When no mechanic is found, **[INFERRED]** the driver leaves the product to get help elsewhere; the PRD does not say what "here's what to do instead" contains. |

### F4. Live tracking and job status

> **Done means:** "the driver sees the mechanic's real position update in near real time from acceptance to arrival."

| | |
|---|---|
| **What the product does** | "Real map with the mechanic's live location and ETA," job status, "In-app chat and masked phone calls." |
| **What the user still does** | **[INFERRED]** Statuses such as "arrived," "working" and "complete" probably have to be tapped in by the mechanic; the PRD does not say how they are set. |

### F5. Integrated payments

> **Done means:** "a driver can complete a job end-to-end without paying outside the app, and the mechanic is paid without any manual step."

| | |
|---|---|
| **What the product does** | Holds the card "at booking for the quoted amount," captures "only on job completion," pays the mechanic "automatic, minus NemaGo's commission." |
| **What the user still does** | "Disputes and refunds handled in-app." **[INFERRED]** The PRD does not say who decides a dispute, so it may be a person at NemaGo. |

### F6. Diagnostic and predictive-maintenance engine (foundational)

> **Done means:** "every completed job writes a complete, structured job record (vehicle, mileage, symptoms, fault codes, predicted diagnosis, confirmed repair, parts, time taken, final price) to the training dataset, and a returning driver receives at least mileage-based service reminders for their vehicle."

| | |
|---|---|
| **What the product does** | Writes the job record and sends "mileage-based reminders from manufacturer service intervals." |
| **What the user still does** | **[INFERRED]** "Confirmed repair," "parts" and "time taken" can only come from the mechanic, so the mechanic has to record them at the end of each job. The PRD does not say how. Mileage between jobs comes from the driver ("mileage logged at every job and reminder") until continuous OBD data, which is out of scope. |

### F7. Technician onboarding and verification

> **Done means:** "no mechanic can receive a job until every verification step below is complete and recorded."

| | |
|---|---|
| **What the product does** | Takes the application. Runs "Automated identity and background checks through a screening provider." Limits new mechanics to "lower-risk job types." Tracks ratings, revised-quote rate and comeback rate. |
| **What still happens by hand** | "Document review of certifications and insurance by NemaGo staff." A "Skills check: a short practical or video assessment"; the PRD does not say who runs it. Getting the certification, insurance, tools and van happens entirely outside the product. |

**Summary [INFERRED].** The driver's side is now mostly inside the product: describing the problem, getting a price, booking, tracking and paying. What still happens by hand is mostly on the mechanic's and NemaGo's side: confirming the diagnosis, writing revised quotes, buying parts, recording the outcome of each job, reviewing documents, running skills checks, and settling disputes. The repair itself happens at the car, outside any software.

---

## 3. WHAT WE HOLD

From the "Data we store" table.

**The customer's own material that lives inside our product:**

| Data | What the PRD says |
|---|---|
| Driver account (name, phone, email) | "Stored" |
| Vehicles (VIN, year/make/model, mileage over time) | "Stored" |
| Symptom photos, descriptions, warning lights | "Stored with consent for training; otherwise deleted after job closes" |
| OBD fault codes | "Stored" |
| Job records (predicted vs. confirmed diagnosis, parts, labor time, quoted vs. final price, ratings) | "Stored" |
| Job address | "only job address kept afterward" |
| Mechanic profile, documents, background-check result | "Stored" |

**What we only pass through without keeping:**

| Data | What the PRD says |
|---|---|
| Driver live location | "Used live during a job; only job address kept afterward" |
| Mechanic live location | "Used live while on shift; not kept afterward" |
| Card numbers | "**Not stored** — held by the payment provider" |
| Symptom photos and descriptions without consent | "deleted after job closes" |

**Other statements:** "Drivers can export or delete their data. Training uses job data with personal identifiers removed."

**Not in the table [INFERRED]:** in-app chat messages, masked-call records, voice descriptions (F1 allows "text or voice"), revised-quote history, and dispute records. The PRD does not say whether these are kept.

---

## 4. DOES IT GET BETTER WITH USE

The PRD says **both**, but the MVP commitment is narrower than that claim.

**What the PRD claims:**
- **For everyone:** "Triage is retrained on confirmed outcomes … so the share of jobs diagnosed correctly before the mechanic arrives goes up." Prices also improve by "Comparing quoted vs. actual labor time and parts."
- **For one user:** "A driver's own history (mileage logged at every job and reminder, past repairs, recurring fault codes), combined with failure patterns across all similar vehicles, lets NemaGo predict likely upcoming failures."

**What the MVP commits to:**
- "The MVP does not claim learned prediction on day one; there isn't enough data yet."
- MVP triage comes from "a general vision/language model plus fault-code lookup." **[INFERRED]** Neither of these is trained on NemaGo's data, so MVP triage does not get better as more people use NemaGo.
- MVP reminders come from "manufacturer service intervals." **[INFERRED]** These are the same for every owner of the same car at the same mileage. Using the app more only updates the mileage figure.
- Learned models arrive "After enough jobs," and "The job volume needed is an open decision."
- The F6 Done-means line commits only to recording the data, not to any improvement.

**So, as committed [INFERRED]:** the MVP collects the data that could make it better for everyone and for each user. It does not commit to when, or at what job volume, that improvement starts.

**Not stated in the PRD [INFERRED]:** whether more mechanics joining shortens ETAs for drivers, and more drivers joining keeps mechanics busier. "Time from booking to mechanic arrival" and "Share of booking requests that found a mechanic" are listed as success metrics, but the PRD never describes the two sides reinforcing each other.

---

## 5. WHO WE DEPEND ON

**Named in the PRD's dependencies table** ("Can a competitor buy it too?" is the PRD's own answer):

| Need | Source named | Can a competitor buy it? |
|---|---|---|
| Labor times, parts, repair procedures | "Mitchell 1 or ALLDATA (licensed)" | "Yes" |
| Photo and text diagnosis | "A vision-capable model from a commercial AI provider" | "Yes" |
| Fault-code reading | "Off-the-shelf Bluetooth OBD-II dongles" | "Yes" |
| Maps, routing, live location | "Google Maps Platform or Mapbox" | "Yes" |
| Payments, holds, mechanic payouts | "Stripe Connect (or equivalent)" | "Yes" |
| Background and identity checks | "A third-party screening provider" | "Yes" |
| Push notifications, masked calls, chat | "Standard messaging/telephony providers" | "Yes" |
| Hosting, database | "A standard cloud provider" | "Yes" |
| Confirmed job outcomes dataset | "Built by NemaGo from its own jobs" | "**No**" |
| Verified mechanic network | "Built by NemaGo" | "Not directly (mechanics can join other platforms too)" |

**Implied elsewhere in the PRD but not in the table [INFERRED]:**

| Dependency | Where it is implied | Could a competitor buy it? |
|---|---|---|
| Parts suppliers | "a parts-supplier catalog"; mechanics who "can source" parts | Yes. **[INFERRED]** |
| Manufacturer service-interval data | "mileage-based reminders from manufacturer service intervals" | Yes. The PRD names no source; such data is commonly included in repair databases. **[INFERRED]** |
| VIN decoding | "VIN scan" | Yes. **[INFERRED]** |
| Speech-to-text | "A short text or voice description" | Yes. **[INFERRED]** |
| Certification bodies (ASE or "equivalent") | Technician "Who qualifies" | Not bought, but every competitor can check the same certifications. **[INFERRED]** |
| Mechanics' insurers | "Active general liability insurance at a stated minimum" | Yes. **[INFERRED]** |
| App stores (Apple, Google) | "the mechanic app"; a driver app | Yes. **[INFERRED]** |
| The independent mechanics themselves | The whole supply side | Yes, in practice. The PRD notes "mechanics can join other platforms too." |

**On the "No" row [INFERRED]:** the outcome dataset cannot be bought. But the research names competitors already running jobs (YourMechanic, Wrench, Spiffy, AutoNation Mobile Service, ClickMechanic; `opportunity-scan.md` section 2, item 7). Any of them can collect the same kind of record from their own jobs.

---

## 6. WHAT WE RULED OUT

| Ruled out (quoted) | What the product cannot do while it stays parked |
|---|---|
| "Towing (NemaGo dispatches mobile repairs only; jobs that need a tow are referred out)." | Help a driver whose car cannot be fixed where it stands. **[INFERRED]** This affects the "Stranded drivers" segment most. The PRD does not say who the driver is "referred out" to. |
| "Jobs that need a lift or a shop (e.g. transmission rebuilds)" | Take larger, higher-value repairs. **[INFERRED]** The research's complaint examples include transmission jobs costing thousands of dollars, which this rules out (`opportunity-scan.md` section 3). |
| "Fleet and business accounts." | Sell to businesses, so the driver is the only payer. **[INFERRED]** This ties to the open decision on "Who pays." |
| "Insurance and warranty claims handling." | Bill an insurer or warranty company, or serve a repair that one of them covers, except by the driver paying and claiming it back themselves. **[INFERRED]** |
| "Continuous OBD telematics between jobs (later phase of the flywheel)." | Collect any vehicle data between jobs. **[INFERRED]** Per-driver prediction depends on job-time data and whatever mileage the driver enters. |
| "Electric-vehicle high-voltage repairs." | Serve EV owners for high-voltage faults. **[INFERRED]** |
| "Markets outside the launch city." | Operate in more than one city. **[INFERRED]** The city itself is not named. |

---

## GAPS

These are the points in the six questions above that `prd.md` does not answer. None of them has been filled in with a guess. Items the PRD lists itself under "Open decisions" are marked *(open decision)*.

**1. The user**
- Which driver segment launches first *(open decision)*.
- Which city *(open decision)*.
- Who pays: the driver only, or also insurers, roadside programs or employers *(open decision)*.
- Which vehicles are supported (makes, model years, fuel types beyond the EV exclusion).
- Whether mechanics are contractors or employees *(open decision)*.
- What counts as an "equivalent recognized certification."

**2. Where the work happens**
- The F1 accuracy target ("an agreed share of cases").
- Who supplies the OBD dongle, and whether the driver pays for it.
- The value of the "regional labor rate," and who sets it.
- Who buys parts, who pays for them up front, and how parts cost is reconciled with the quoted price.
- How revised quotes are built, and whether they use the same database pricing.
- Who absorbs the cost when a job runs over book time *(open decision)*.
- The amounts of the call-out fee, service fee and commission *(open decision)*.
- What the "here's what to do instead" message offers.
- How job statuses are set during a job.
- Who decides disputes and refunds.
- Who runs the skills check, and what it consists of.
- How the mechanic records "confirmed repair," "parts" and "time taken."

**3. What we hold**
- How long each type of stored data is kept.
- Whether OBD fault codes need consent, as photos do.
- Whether deleting your data also removes it from the training set.
- Whether chat messages, call records, voice recordings, revised quotes and dispute records are kept.
- How long background-check results are kept.
- Whether any data is shared with or sold to third parties (for example insurers or parts suppliers).
- Which privacy laws apply.

**4. Does it get better with use**
- The job volume at which NemaGo-trained models replace the general model *(open decision)*.
- A Done-means line or date for learned triage, pricing or prediction. F6 covers capture only.
- How the accuracy of mechanic-entered outcomes (the training labels) is checked.
- Whether the two sides of the marketplace are meant to strengthen each other.

**5. Who we depend on**
- Mitchell 1 or ALLDATA, and whether either licence permits consumer-facing pricing *(open decision)*.
- Which AI provider and model.
- Google Maps Platform or Mapbox.
- Which screening, payments (if not Stripe Connect), messaging and telephony providers.
- The source of manufacturer service-interval data.
- Which parts suppliers.
- Whether the driver and mechanic apps are native, web or both.
- Whether mechanics are exclusive to NemaGo.

**6. What we ruled out**
- Who towing jobs are "referred out" to.
- When any out-of-scope item comes back, and on what trigger.
- Insurance minimums for mechanics, and NemaGo's own liability cover *(open decision)*.
