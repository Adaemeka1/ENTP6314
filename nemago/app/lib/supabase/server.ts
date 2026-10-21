import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for server components, server actions and route handlers.
// The session lives in cookies, so this reads and writes them via next/headers.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server components can't set cookies. The middleware refreshes
            // the session instead, so this is safe to ignore.
          }
        },
      },
    },
  );
}
