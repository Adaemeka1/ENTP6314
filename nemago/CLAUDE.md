# nemago

Scope guardrails for this subfolder. See [prd.md](prd.md) for the full product
spec. This file applies only within `nemago/` and does not override or
replace the root [`../CLAUDE.md`](../CLAUDE.md), which still governs the
unrelated `Session2_BadPrompt` / `Session2_DetailedPrompt` comparison project.

## What this folder is

A **single-file, interactive frontend prototype** of NemaGo — a simulated
roadside-assistance consumer journey. Everything here is a mocked UI demo,
not a real product with a backend.

## Hard constraints for any work in this folder

- **Single-file only**: the app lives in one `index.html` with inline
  `<style>` and `<script>`. Do not split into separate `.js`/`.css` files,
  components, or a build pipeline.
- **No imports, no dependencies**: no npm/package.json, no CDN scripts, no
  frameworks (React, Vue, etc.), no bundlers. Plain HTML/CSS/JS only.
- **No database, no backend, no API calls**: no fetch/XHR to real services,
  no schemas, no server code, no `db/`, `api/`, `schemas/`, or similar
  fragmented folders. Mock data lives inline in the script as plain JS
  objects/arrays.
- **No real ML/AI, no real maps/geolocation, no real-time infra**: any
  "smart" or "live" behavior (diagnostics, dispatch, tracking) must be
  simulated client-side (timers, canned responses, CSS/SVG animation) — never
  a real integration.
- Keep it small and readable: this is a prototype meant to be opened directly
  in a browser, not a scalable app architecture.

## If scope is asked to grow

If a future request asks for a real backend, real ML, real maps, or splitting
this into multiple files/folders, treat that as a deliberate scope change and
confirm it explicitly before doing it — don't drift into it incrementally.
