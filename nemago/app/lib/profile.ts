import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: "driver" | "mechanic";
  full_name: string | null;
  mechanic_verified: boolean;
};

// Signed-in user plus their NemaGo profile. Sends them to /login if signed
// out, or to /choose-role if they haven't picked driver or mechanic yet.
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, mechanic_verified")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) redirect("/choose-role");
  return { user, profile };
}

export function firstName(profile: Profile, email: string | undefined) {
  return profile.full_name?.split(" ")[0] || email?.split("@")[0] || "there";
}
