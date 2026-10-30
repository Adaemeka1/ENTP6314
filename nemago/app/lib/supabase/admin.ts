import { createClient } from "@supabase/supabase-js";

// Supabase client that uses the secret (service role) key. It skips every
// security rule, so it must only ever be used in server routes and never be
// imported by a screen. Returns null if the key isn't set up.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
