import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/profile";

// The front door: sends each person to the right home screen.
// (Signed-out visitors never get here; the middleware sends them to /login.)
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const { profile } = await requireProfile();
  const suffix = (await searchParams).password === "updated" ? "?password=updated" : "";
  redirect(profile.role === "mechanic" ? `/mechanic${suffix}` : `/driver${suffix}`);
}
