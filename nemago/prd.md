# NemaGo — Product Requirements Document

## What this is

NemaGo is a **simulated, single-file, mobile-responsive frontend prototype** of a
consumer roadside-assistance experience. It is a UI/UX demo, not a working
backend product: there is no real diagnosis AI, no real technician network,
no real dispatch, and no real maps API. Every "smart" behavior in the app is
mocked with deterministic or randomized client-side logic so the app is fully
functional offline, in a single HTML file, with zero dependencies.

## Why this scope

An earlier pass explored a full dual-system product (on-demand mechanic
marketplace + AI predictive-maintenance engine with sensor/audio logging and
real dispatch routing). That is out of scope for this prototype — it's a
multi-service backend, ML, and real-time infrastructure problem, not a
single-file frontend problem. This PRD intentionally scopes NemaGo down to a
**simulated 4-step consumer journey** that demonstrates the idea without any
of that infrastructure.

## User journey (4 steps, linear, in one page)

### Step 1 — Symptom diagnostic (simulated)
- User picks/mocks-uploads a photo representing a car symptom (e.g. fluid
  leak, worn belt, dashboard light) — no real image analysis; the user picks
  from a small set of symptom categories (or drops any image file, which is
  only used to show a filename/preview, never analyzed).
- App returns a canned, plain-language "AI diagnostic" response mapped to the
  chosen symptom category (e.g. "This looks like a coolant leak — likely a
  worn hose or radiator seal.").

### Step 2 — Upfront price estimate (simulated)
- Based on the Step 1 diagnostic, show a guaranteed flat-price estimate
  (a fixed or lightly randomized number per symptom category) with a short
  breakdown (parts/labor placeholder line items).
- Clear "guaranteed price, no surprises" messaging — purely cosmetic/static
  copy, no real pricing engine.

### Step 3 — Technician matchmaking (simulated)
- A short animated "searching for nearby technicians..." state.
- Resolves to a mocked technician profile (name, rating, ETA, vehicle) drawn
  from a small static list.

### Step 4 — Live tracking map (simulated)
- A stylized map area (CSS/SVG, not a real map tile provider) showing a
  mechanic icon animating from a starting point toward a "you are here" pin
  over ~15-30 seconds.
- A progress bar / ETA countdown synced to the animation.
- Ends in a "technician has arrived" confirmation state.

## Explicit non-goals

- No backend, no database, no API calls, no auth, no payments.
- No real image recognition / ML of any kind.
- No real mapping/geolocation APIs (no Google Maps, Mapbox, etc.).
- No real-time infrastructure (no websockets, no push notifications).
- No predictive maintenance engine, no sensor/audio data logging.
- No build step, no package manager, no external JS dependencies.

## Technical constraints

- **Single file**: `index.html` containing all HTML, CSS, and JS inline.
- **Zero dependencies**: no CDN scripts, no frameworks, no imports.
- Mobile-responsive, works by opening the file directly in a browser.
- All "data" (symptom list, technician list, pricing) lives in a small JS
  object/array at the top of the script — easy to read and tweak.

## Success criteria

- Opening `index.html` in a browser lets a user click through all 4 steps
  start to finish with no errors, no network requests, and no external
  assets.
- Looks and feels like a polished consumer product, even though every
  "intelligent" behavior underneath is mocked.
