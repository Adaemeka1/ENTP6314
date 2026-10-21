import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthCard, Notice } from "@/components/AuthCard";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Reset password · NemaGo" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <Notice kind="success">
          If that email has a NemaGo account, a reset link is on its way.
        </Notice>
      ) : (
        <form action={requestPasswordReset} className="form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
        </form>
      )}
      <p className="switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </AuthCard>
  );
}
