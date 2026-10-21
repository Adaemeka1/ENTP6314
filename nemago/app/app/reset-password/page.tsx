import { updatePassword } from "@/app/auth/actions";
import { AuthCard, Notice } from "@/components/AuthCard";
import { SubmitButton } from "@/components/SubmitButton";
import { errorMessage } from "@/lib/messages";

export const metadata = { title: "New password · NemaGo" };

// Reached from the reset email. The link signs them in first (via
// /auth/callback), which is why this page can change the password.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = errorMessage((await searchParams).error);

  return (
    <AuthCard title="Choose a new password">
      {error && <Notice kind="error">{error}</Notice>}
      <form action={updatePassword} className="form">
        <label>
          New password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label>
          Type it again
          <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
      </form>
    </AuthCard>
  );
}
