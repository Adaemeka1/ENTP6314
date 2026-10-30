import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Small helpers shared by the payment API routes.

export function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export const notConfigured = () => json({ error: "payments_not_configured" }, 503);

// Who is signed in? Checked on the server from the session cookie.
export async function getSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Reads the JSON body, or returns null if it isn't valid JSON.
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Database rule names we are happy to show the browser. Anything else becomes "failed".
const SAFE_ERRORS = [
  "already_active",
  "not_a_driver",
  "not_awaiting_payment",
  "cannot_cancel",
  "cannot_complete",
  "not_paid",
  "payouts_not_set_up",
];

export function safeError(message: string | undefined) {
  return message && SAFE_ERRORS.includes(message) ? message : "failed";
}
