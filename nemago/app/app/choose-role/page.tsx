import { redirect } from "next/navigation";
import { chooseRole } from "@/app/auth/actions";
import { AuthCard, Notice } from "@/components/AuthCard";
import { RolePicker } from "@/components/RolePicker";
import { SubmitButton } from "@/components/SubmitButton";
import { errorMessage } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "One more step · NemaGo" };

export default async function ChooseRolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already picked a role? The role can't be changed here.
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");

  const error = errorMessage((await searchParams).error);

  return (
    <AuthCard title="One more step" subtitle="Tell us how you'll use NemaGo.">
      {error && <Notice kind="error">{error}</Notice>}
      <form action={chooseRole} className="form">
        <RolePicker />
        <SubmitButton pendingText="Saving…">Continue</SubmitButton>
      </form>
    </AuthCard>
  );
}
