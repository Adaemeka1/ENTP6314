import { Logo, Notice } from "@/components/AuthCard";

// Header with the logo and a sign-out button, for signed-in screens.
export function AppShell({
  passwordUpdated,
  children,
}: {
  passwordUpdated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="topbar">
        <Logo />
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-ghost">
            Sign out
          </button>
        </form>
      </header>
      <main className="app-page">
        {passwordUpdated && <Notice kind="success">Your password was changed.</Notice>}
        {children}
      </main>
    </>
  );
}
