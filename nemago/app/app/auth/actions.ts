"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";

const ROLES = ["driver", "mechanic"] as const;
type Role = (typeof ROLES)[number];

// Turns Supabase error codes into the short codes our pages know how to show.
// We never put Supabase's raw message in the URL.
function errorCode(code: string | undefined) {
  switch (code) {
    case "invalid_credentials":
    case "email_not_confirmed":
    case "weak_password":
    case "over_email_send_rate_limit":
      return code;
    default:
      return "generic";
  }
}

async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function signInWithPassword(formData: FormData) {
  const next = safeNext(field(formData, "next"));
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: field(formData, "email"),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    redirect(`/login?error=${errorCode(error.code)}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(field(formData, "next"));
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) redirect("/login?error=oauth");
  // Sends the browser to Google's own sign-in page.
  redirect(data.url);
}

export async function signUp(formData: FormData) {
  const role = field(formData, "role") as Role;
  const fullName = field(formData, "full_name");
  const password = String(formData.get("password") ?? "");

  if (!ROLES.includes(role)) redirect("/signup?error=role_missing");
  if (password.length < 8) redirect("/signup?error=weak_password");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: field(formData, "email"),
    password,
    options: {
      // Saved with the account; the database trigger copies it into profiles.
      data: { role, full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });

  if (error) redirect(`/signup?error=${errorCode(error.code)}`);
  // If email confirmation is turned off in Supabase, they're signed in now.
  if (data.session) redirect("/");
  redirect("/signup?sent=1");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(field(formData, "email"), {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  // Same message whether or not the email has an account, so nobody can use
  // this form to find out who has signed up.
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) redirect("/reset-password?error=password_mismatch");
  if (password.length < 8) redirect("/reset-password?error=weak_password");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${errorCode(error.code)}`);
  redirect("/?password=updated");
}

// Google sign-ins don't go through our sign-up form, so they pick a role here
// after their first login.
export async function chooseRole(formData: FormData) {
  const role = field(formData, "role") as Role;
  if (!ROLES.includes(role)) redirect("/choose-role?error=role_missing");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    role,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
  });

  if (error) {
    console.error("chooseRole insert failed:", error.code, error.message);
    redirect("/choose-role?error=generic");
  }
  redirect("/");
}
