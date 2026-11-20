// Repair quote rules (the Secondary Approval Gate), shared by the mechanic's form, the
// driver's screen and the server. The database checks everything again.
//
// Net balance due = parts total + labor total - $80.00 diagnostic credit.
// Money buckets for the balance:
//   parts total            100% NemaGo
//   labor total - $80      90% mechanic / 10% NemaGo
// (The first $80 of labor was already split 90/10 as the diagnosis fee.)

import { DIAGNOSTIC_FEE_CENTS } from "./fees";
import { mechanicPayoutCents } from "./pricing";

export const REPAIR_CREDIT_CENTS = DIAGNOSTIC_FEE_CENTS;
export const MAX_REPAIR_CENTS = 500000; // $5,000 each for parts and labor
export const MIN_NET_DUE_CENTS = 100; // $1.00
export const MAX_SUMMARY = 300;
export const MAX_DESCRIPTION = 1000;
export const MAX_DAYS_AHEAD = 30;

// Demo photos for now. Real photo upload needs a consent and storage flow first
// (see "Data handling" in nemago/CLAUDE.md), so the mechanic picks a demo photo.
export const DEMO_PHOTOS = [
  { id: "brake_pads", label: "Worn brake pads" },
  { id: "battery_terminal", label: "Corroded battery terminal" },
  { id: "coolant_leak", label: "Leaking coolant hose" },
  { id: "worn_belt", label: "Cracked drive belt" },
  { id: "tire_damage", label: "Damaged tire" },
] as const;
export type DemoPhotoId = (typeof DEMO_PHOTOS)[number]["id"];

export function photoLabel(id: string) {
  return DEMO_PHOTOS.find((p) => p.id === id)?.label ?? "Photo";
}

// Two-hour arrival windows.
export const REPAIR_WINDOWS = [
  { start: "08:00", label: "8:00 AM – 10:00 AM" },
  { start: "10:00", label: "10:00 AM – 12:00 PM" },
  { start: "12:00", label: "12:00 PM – 2:00 PM" },
  { start: "14:00", label: "2:00 PM – 4:00 PM" },
  { start: "16:00", label: "4:00 PM – 6:00 PM" },
] as const;

export type RepairMath = {
  partsCents: number;
  laborCents: number;
  creditCents: number;
  netDueCents: number;
  // The labor still to be collected after the credit.
  laborNetCents: number;
  mechanicPayoutCents: number;
  nemagoLaborCutCents: number;
  // Everything NemaGo keeps of the balance: the parts and its labor cut.
  nemagoKeepsCents: number;
};

export function repairMath(partsCents: number, laborCents: number): RepairMath {
  const laborNetCents = laborCents - REPAIR_CREDIT_CENTS;
  const mechanic = mechanicPayoutCents(Math.max(0, laborNetCents));
  const cut = Math.max(0, laborNetCents) - mechanic;
  return {
    partsCents,
    laborCents,
    creditCents: REPAIR_CREDIT_CENTS,
    netDueCents: partsCents + laborNetCents,
    laborNetCents,
    mechanicPayoutCents: mechanic,
    nemagoLaborCutCents: cut,
    nemagoKeepsCents: partsCents + cut,
  };
}

// "1,250.50" or "$120" -> cents. Anything that isn't a plain dollar amount -> null.
export function parseDollars(text: string): number | null {
  const clean = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export type QuoteInput = {
  summary: string;
  description: string;
  photoId: string;
  partsCents: number | null;
  laborCents: number | null;
  date: string; // yyyy-mm-dd
  windowStart: string;
};

// A plain-English problem with the quote, or null if it looks fine.
export function quoteProblem(q: QuoteInput, todayIso: string): string | null {
  if (q.summary.trim().length < 3) return "Write a short issue summary.";
  if (q.summary.trim().length > MAX_SUMMARY) return `Keep the summary under ${MAX_SUMMARY} characters.`;
  if (q.description.trim().length < 3) return "Describe the repair that is needed.";
  if (q.description.trim().length > MAX_DESCRIPTION) return `Keep the description under ${MAX_DESCRIPTION} characters.`;
  if (!DEMO_PHOTOS.some((p) => p.id === q.photoId)) return "Choose a photo.";
  if (q.partsCents === null || q.partsCents < 0 || q.partsCents > MAX_REPAIR_CENTS) {
    return "Enter the parts total in dollars (use 0 if there are no parts).";
  }
  if (q.laborCents === null || q.laborCents > MAX_REPAIR_CENTS) return "Enter the labor total in dollars.";
  if (q.laborCents < REPAIR_CREDIT_CENTS) return "Labor must be at least $80.00, the diagnostic credit.";
  if (q.partsCents + q.laborCents - REPAIR_CREDIT_CENTS < MIN_NET_DUE_CENTS) {
    return "The balance due must be at least $1.00.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return "Choose a repair date.";
  if (q.date < todayIso) return "The repair date can't be in the past.";
  if (q.date > addDays(todayIso, MAX_DAYS_AHEAD)) return `Choose a date within ${MAX_DAYS_AHEAD} days.`;
  if (!REPAIR_WINDOWS.some((w) => w.start === q.windowStart)) return "Choose a time window.";
  return null;
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

// Today's date in Dallas, as yyyy-mm-dd (the database checks dates in Dallas time).
export function todayInDallas(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

// "Mon, Nov 23 · 10:00 AM – 12:00 PM" from "2026-11-23" and "10:00:00".
export function formatRepairWhen(dateIso: string, windowStart: string) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  const window = REPAIR_WINDOWS.find((w) => w.start === windowStart.slice(0, 5));
  return window ? `${day} · ${window.label}` : day;
}
