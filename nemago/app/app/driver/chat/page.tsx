import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ChatBox } from "@/components/ChatBox";
import { requireProfile } from "@/lib/profile";

export const metadata = { title: "Car Helper · NemaGo" };

export default async function DriverChat() {
  const { profile } = await requireProfile();
  if (profile.role !== "driver") redirect("/");

  return (
    <AppShell>
      <Link href="/driver" className="back-link">
        ← Back
      </Link>
      <h1>Car Helper</h1>
      <p className="muted">Describe the problem and get a quick, plain-English answer.</p>
      <ChatBox />
    </AppShell>
  );
}
