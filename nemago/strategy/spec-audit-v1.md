# NemaGo: Spec Audit

**Sources read:** `nemago/prd.md` (the spec) and `nemago/research/opportunity-scan.md` (the competitor and market research; there is no `competitors.md`, and this file is the nearest match).
**Date:** 2026-10-07

This audit only describes what `prd.md` commits us to. It gives no advice. Text in quotation marks comes from `prd.md` unless it says otherwise. **[INFERRED]** marks anything I worked out myself rather than read in the PRD.

One thing shapes every section below. `prd.md` specifies a **prototype**, not a product:

> "NemaGo is a **simulated, single-file, mobile-responsive frontend prototype** of a consumer roadside-assistance experience. It is a UI/UX demo, not a working backend product"

So the PRD commits us to a demo. The real roadside-assistance product is described only as an "earlier pass" that has been put out of scope. Where a question below is about the real product, the PRD mostly has nothing to say, and that is recorded under GAPS.

---

## 1. THE USER

**What `prd.md` says.** The PRD has no section that defines the user. Every mention of the user is one of these:

- "a consumer roadside-assistance experience"
- "a **simulated 4-step consumer journey**"
- "User picks/mocks-uploads a photo representing a car symptom"
- "Looks and feels like a polished consumer product"
- Step 4: a "you are here" pin, so the user is wherever the car is.

**One group or a broad category?** It is a broad category. "Consumer" covers anyone who owns or drives a car. The PRD does not say whether that person is stranded at the roadside or planning a repair at home. It also doesn't name their location, their vehicle, whether they already have roadside cover such as AAA, an insurer or a car-maker plan, or who pays.

**[INFERRED]** The research file, not the PRD, splits this category into at least three groups that behave like different buyers (`opportunity-scan.md`, section 1, "Who specifically has this problem"):

1. "Any driver mid-breakdown/stranded"
2. "'Busy' drivers who can't take a car to a shop during business hours"
3. "Distrustful drivers who avoid/delay shop visits"

The PRD does not say which of these it is built for. Its name for the experience, "roadside-assistance", points toward group 1. Its flow (pick a symptom, get a guaranteed price, then wait 15 to 30 seconds for a technician) matches groups 2 and 3 equally well. **[INFERRED]**

---

## 2. WHERE THE WORK HAPPENS

`prd.md` has no "done means" line for any feature. The closest things to them are the two "Success criteria" bullets, which cover the whole journey rather than individual steps:

> "Opening `index.html` in a browser lets a user click through all 4 steps start to finish with no errors, no network requests, and no external assets."
> "Looks and feels like a polished consumer product, even though every 'intelligent' behavior underneath is mocked."

Each feature is described below for two cases. **As specified** is the prototype the PRD commits to. **The job it stands for** is the real-world task the step pretends to do.

### Step 1: Symptom diagnostic (simulated)

| | |
|---|---|
| **What the product does itself** | It shows "a canned, plain-language 'AI diagnostic' response mapped to the chosen symptom category." If an image is dropped in, it shows the filename or a preview, which is "never analyzed." |
| **What the user still does** | The user does the diagnosing. The spec says "the user picks from a small set of symptom categories," so the user decides whether the problem is a leak, a belt or a warning light, and the product repeats a sentence written for that category. **[INFERRED]** Recognising the symptom, the hard part of the job, happens in the user's head before they touch the app. Confirming the diagnosis happens later with a real mechanic, outside the product. |
| **"Done means"** | None given. |

### Step 2: Upfront price estimate (simulated)

| | |
|---|---|
| **What the product does itself** | It shows "a fixed or lightly randomized number per symptom category" with "parts/labor placeholder line items" and the message "guaranteed price, no surprises", which the PRD calls "purely cosmetic/static copy, no real pricing engine." |
| **What the user still does** | **[INFERRED]** Everything that makes a price real happens outside the product: getting an actual quote from a mechanic or shop, checking it against other quotes (the research describes drivers who "Call around to multiple shops for phone quotes"), and holding someone to it. The PRD does not say who stands behind the "guarantee." |
| **"Done means"** | None given. |

### Step 3: Technician matchmaking (simulated)

| | |
|---|---|
| **What the product does itself** | It shows "A short animated 'searching for nearby technicians...' state," then "a mocked technician profile (name, rating, ETA, vehicle) drawn from a small static list." |
| **What the user still does** | **[INFERRED]** All of the actual job: finding a real mechanic through AAA, an insurer, Google or Yelp, a friend, or a competing app (the alternatives listed in the research, section 2), then contacting them, booking them, and checking that they are any good. Nobody is booked through the prototype. |
| **"Done means"** | None given. |

### Step 4: Live tracking map (simulated)

| | |
|---|---|
| **What the product does itself** | It shows "A stylized map area (CSS/SVG, not a real map tile provider)" with an icon moving "over ~15-30 seconds," a synced ETA countdown, and a "technician has arrived" confirmation. |
| **What the user still does** | **[INFERRED]** Waiting for a real technician, and finding out where they are by phone or text or through the provider's own app. The repair itself, paying for it, and any warranty or dispute afterwards all happen outside the product. Payments are out of scope: "no payments." |
| **"Done means"** | None given. |

**Summary [INFERRED].** As specified, every one of the four steps is a display. The product shows a screen, and all the real work happens by hand or in some other tool or service: diagnosing the car, pricing the job, finding and booking a mechanic, tracking their arrival, the repair, and payment. The user also supplies the one real input, the symptom category, and makes the one real decision.

---

## 3. WHAT WE HOLD

`prd.md` has **no "DATA WE STORE" section.** These are the statements in it that bear on data:

- "No backend, no database, no API calls, no auth, no payments."
- "No predictive maintenance engine, no sensor/audio data logging."
- "All 'data' (symptom list, technician list, pricing) lives in a small JS object/array at the top of the script"
- On the user's photo: "only used to show a filename/preview, never analyzed."

**The customer's own material that would live inside our product:**
- None is stated. **[INFERRED]** There is no backend, database or account, so the prototype keeps nothing of the user's after the page closes.

**What we pass through without keeping:**
- The photo the user drops in. The PRD says it is shown as a filename or preview and "never analyzed." **[INFERRED]** It also never says the photo is kept. (The built `index.html` turns the file into a temporary in-browser preview link, `URL.createObjectURL`, and has no `localStorage` or network calls. That comes from the code, not the PRD.)
- The symptom category the user picks. It is used to choose a canned response and price. **[INFERRED]** Nothing says it is kept.

**What we hold that is not the customer's:**
- The symptom list, the technician list and the price table. These are our own placeholder data, written into the script.

**For the real product:** the PRD says nothing about what it would store. The excluded "sensor/audio data logging" is the only hint that some version of NemaGo was once meant to keep vehicle data.

---

## 4. DOES IT GET BETTER WITH USE

**Neither,** as specified. **[INFERRED]** The reasons all come from the PRD:

- **Not for one user.** There is "no auth" and "no database," so the product cannot tell a returning user apart from a new one, and nothing they did before is kept. The diagnostic is "canned" and the price is "fixed or lightly randomized," so the hundredth visit gives the same output as the first.
- **Not for everyone as more people join.** There is "no backend," so one user's activity never reaches another user. The technician list is "a small static list" that does not grow when more drivers or mechanics turn up. There is "No real image recognition / ML of any kind," so no model learns from accumulated photos.

The only feature in either document that would get better with use is the one the PRD has put out of scope: "AI predictive-maintenance engine with sensor/audio logging." The research's claimed gains come from "AI models cross-referencing live sensor readings against large historical repair-pattern datasets" (`opportunity-scan.md`, section 4, item 5). **[INFERRED]** That describes a data-driven engine, which is exactly what the PRD excludes.

The PRD does not say whether the real product would get better with use.

---

## 5. WHO WE DEPEND ON

**As specified, the prototype depends on no outside company.** The PRD rules them out directly: "**Zero dependencies**: no CDN scripts, no frameworks, no imports." It also lists "No real mapping/geolocation APIs (no Google Maps, Mapbox, etc.)" and "No build step, no package manager, no external JS dependencies." The only thing it relies on is "a browser" ("works by opening the file directly in a browser").

**For the real product,** the PRD implies dependencies only by naming what it leaves out. Each one below is something the out-of-scope product would need **[INFERRED]**, with a note on whether a competitor could buy the same thing.

| Dependency the real product would need | Where the PRD implies it | Could a competitor buy the same thing? |
|---|---|---|
| A web browser or mobile platform | "works by opening the file directly in a browser" (stated for the prototype) | Yes. Every competitor already runs on the same browsers and phone platforms. **[INFERRED]** |
| An image-recognition or vision AI model | "No real image recognition / ML of any kind"; "no real diagnosis AI" | Yes. The research describes vision-capable LLMs as broadly available and better than older purpose-built models (`opportunity-scan.md`, section 4, item 3). **[INFERRED]** |
| A maps and geolocation provider | "No real mapping/geolocation APIs (no Google Maps, Mapbox, etc.)" | Yes. Google Maps and Mapbox, the two the PRD names, sell to anyone. **[INFERRED]** |
| A network of technicians or mechanics | "no real technician network" | Not off the shelf as a product. **[INFERRED]** Competitors build their own; the research names YourMechanic, Wrench, Spiffy, AutoNation Mobile Service and ClickMechanic, and notes that Wrench bought YourMechanic (section 2, item 7). Independent mobile mechanics can usually work for more than one platform, so a competitor could probably sign up the same people. The PRD does not say whether ours would be exclusive. |
| Dispatch and routing | "no real dispatch"; "real dispatch routing" (the earlier pass) | Partly. Routing comes from the same map providers. Dispatch logic would be built rather than bought. **[INFERRED]** |
| Real-time infrastructure (websockets, push notifications) | "No real-time infrastructure (no websockets, no push notifications)" | Yes. These are general-purpose services that anyone can buy. **[INFERRED]** |
| A payments provider | "no payments" | Yes. **[INFERRED]** |
| Authentication or identity | "no auth" | Yes. **[INFERRED]** |
| Backend hosting and a database | "No backend, no database, no API calls" | Yes. **[INFERRED]** |
| A source of vehicle data (sensors, audio, possibly OBD) | "No predictive maintenance engine, no sensor/audio data logging" | Yes, as far as the research goes. It describes cheap Bluetooth OBD2 dongles and an SAE standard (J1979-2) that becomes mandatory for 2027 models (section 4, items 1 and 2). **[INFERRED]** |
| Real repair-price data (parts and labour rates) to back a "guaranteed price" | "no real pricing engine" | The PRD does not say where this data would come from, so this question cannot be answered. |

---

## 6. WHAT WE RULED OUT

The PRD rules things out in three places: the "Explicit non-goals" list, the "Why this scope" paragraph, and the "Technical constraints." Each item is listed below with what the product cannot do while that item stays parked.

### From "Explicit non-goals"

| Ruled out (quoted) | What the product cannot do while it stays parked |
|---|---|
| "No backend" | Keep anything between sessions or between users, or send anything anywhere. **[INFERRED]** |
| "no database" | Remember users, jobs, prices or technicians beyond the hard-coded list. **[INFERRED]** |
| "no API calls" | Use any outside service: AI, maps, payments or a real technician. **[INFERRED]** |
| "no auth" | Tell one user from another, keep a history, or show anyone their past jobs. **[INFERRED]** |
| "no payments" | Take money, which means it cannot charge for a job or stand behind its "guaranteed price." **[INFERRED]** |
| "No real image recognition / ML of any kind" | Diagnose anything. The user has to pick the category, and the "diagnosis" is canned text. |
| "No real mapping/geolocation APIs (no Google Maps, Mapbox, etc.)" | Know where the user is, where a technician is, or how far apart they are. ETAs are invented. **[INFERRED]** |
| "No real-time infrastructure (no websockets, no push notifications)" | Show any live update from a real technician, or tell a user anything once they've closed the page. **[INFERRED]** |
| "No predictive maintenance engine" | Warn a user about a problem before it happens. It can only respond to a symptom the user already has. **[INFERRED]** |
| "no sensor/audio data logging" | Collect any vehicle data, so nothing builds up over time for one car or across cars. **[INFERRED]** |
| "No build step, no package manager, no external JS dependencies" | Use any outside library. Everything has to be hand-written in one file. **[INFERRED]** |

### From "Why this scope"

| Ruled out (quoted) | What the product cannot do while it stays parked |
|---|---|
| "a full dual-system product (on-demand mechanic marketplace + AI predictive-maintenance engine with sensor/audio logging and real dispatch routing)" | Act as a marketplace, so it cannot connect a real driver with a real mechanic, or take part in any transaction between them. **[INFERRED]** |

### From "Technical constraints"

| Constraint (quoted) | What the product cannot do while it holds |
|---|---|
| "**Single file**: `index.html` containing all HTML, CSS, and JS inline." | Grow into a multi-part app, such as a separate mechanic-facing app or an admin tool. **[INFERRED]** |
| "All 'data' (symptom list, technician list, pricing) lives in a small JS object/array" | Cover more than a small, fixed set of symptoms, technicians and prices. Changing any of them means editing the code. **[INFERRED]** |

---

## GAPS

These are the points in the six questions above that `prd.md` does not answer. None of them has been filled in with a guess.

**1. The user**
- The PRD never defines the user. "Consumer" is the only description.
- It doesn't say whether the user is stranded at the roadside, busy and planning a repair, or a driver who avoids shops. These are the three groups the research names.
- It doesn't say where the user is (country, region, city or rural).
- It doesn't say what kind of vehicle they drive.
- It doesn't say whether they already have AAA, insurer or car-maker roadside cover.
- It doesn't say who pays: the driver, an insurer or an employer.

**2. Where the work happens**
- No feature has a "done means" line. There are only two success criteria for the whole journey.
- For the real product, the PRD does not say which of these NemaGo would do itself and which would stay with the user or another tool: diagnosis, pricing, booking, dispatch, tracking, payment, the repair, warranty or disputes.
- It does not say who stands behind the "guaranteed price."
- It does not say what happens when the technician arrives: the repair, payment, review, or a job that turns out to be different from the diagnosis.

**3. What we hold**
- There is no DATA WE STORE section.
- For the real product, it doesn't say which customer data would be kept: photos, location, vehicle details, job history, payment details, or sensor and audio data.
- It doesn't say which data would only pass through.
- It doesn't say whether the prototype keeps anything in the browser. "No database" is stated, but browser storage is not mentioned either way.

**4. Does it get better with use**
- The PRD does not discuss this at all, for the prototype or for the real product.
- It does not say whether the real product would learn from photos, jobs, prices or vehicle data, or whether the technician side grows as the user side grows.

**5. Who we depend on**
- The PRD names no supplier for the real product. Every dependency in section 5 is inferred from the list of things it excludes.
- It doesn't say which AI model or provider would do the diagnosis.
- It doesn't say which maps provider would be used. Google Maps and Mapbox are named only as examples of what is excluded.
- It doesn't say where technicians would come from, whether they would be employees, contractors or partner shops, or whether they would be exclusive to NemaGo.
- It doesn't say where real price data would come from.
- It doesn't name a payments provider.
- It doesn't say whether vehicle data would come from OBD dongles, phone sensors or anything else.

**6. What we ruled out**
- The PRD does not say which out-of-scope items would come back first, or under what conditions.
- It does not say whether the "dual-system" product (marketplace plus predictive maintenance) is still the long-term plan or has been dropped.

**Across all sections**
- The PRD specifies a demo. It does not specify what NemaGo would be as a working product, so none of the six questions can be answered for the product NemaGo would actually compete as.
