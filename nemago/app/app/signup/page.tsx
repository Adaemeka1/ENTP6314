import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AuthCard, Divider, GoogleButton, Notice } from "@/components/AuthCard";
import { RolePicker } from "@/components/RolePicker";
import { SubmitButton } from "@/components/SubmitButton";
import { errorMessage } from "@/lib/messages";

export const metadata = { title: "Sign up · NemaGo" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const error = errorMessage(params.error);

  if (params.sent) {
    return (
      <AuthCard title="Check your email">
        <Notice kind="success">
          We sent you a link to confirm your email. Open it on this device to finish signing up.
        </Notice>
        <p className="switch">
          <Link href="/login">Back to sign in</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account">
      {error && <Notice kind="error">{error}</Notice>}

      {/* Google users pick driver or mechanic right after signing in. */}
      <GoogleButton label="Sign up with Google" />
      <Divider />

      <form action={signUp} className="form">
        <RolePicker />
        <label>
          Full name
          <input name="full_name" type="text" autoComplete="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          <small className="muted">At least 8 characters.</small>
        </label>
        <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      </form>

      <p className="switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </AuthCard>
  );
}
