import { createBrowserClient } from "@supabase/ssr";

// Supabase client for screens that run in the browser (the live job screens).
// It reads the signed-in session from the same cookies the server uses.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
