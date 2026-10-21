import Link from "next/link";
import { signInWithPassword } from "@/app/auth/actions";
import { AuthCard, Divider, GoogleButton, Notice } from "@/components/AuthCard";
import { SubmitButton } from "@/components/SubmitButton";
import { errorMessage } from "@/lib/messages";
import { safeNext } from "@/lib/redirect";

export const metadata = { title: "Sign in · NemaGo" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; signed_out?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const error = errorMessage(params.error);

  return (
    <AuthCard title="Sign in" subtitle="Drivers and mechanics both sign in here.">
      {params.signed_out && <Notice kind="success">You’re signed out.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      <GoogleButton next={next} />
      <Divider />

      <form action={signInWithPassword} className="form">
        <input type="hidden" name="next" value={next} />
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <Link href="/forgot-password" className="link-small">
          Forgot password?
        </Link>
        <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      </form>

      <p className="switch">
        New here? <Link href="/signup">Sign up</Link>
      </p>
    </AuthCard>
  );
}
