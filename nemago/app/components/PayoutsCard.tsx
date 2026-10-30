"use client";

import { useEffect, useState } from "react";
import { friendlyError, postJson } from "@/lib/dispatch";

// The mechanic's payout setup. "Set Up Payouts" sends them to Stripe's own page,
// where they link a bank account or debit card. NemaGo never sees those details.
export function PayoutsCard({
  hasAccount,
  payoutsEnabled,
  returned,
}: {
  hasAccount: boolean;
  payoutsEnabled: boolean;
  returned: boolean;
}) {
  const [account, setAccount] = useState(hasAccount);
  const [enabled, setEnabled] = useState(payoutsEnabled);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Coming back from Stripe (or with setup unfinished): ask Stripe where things stand.
  useEffect(() => {
    if (!hasAccount || (payoutsEnabled && !returned)) return;
    let stopped = false;
    async function check() {
      setChecking(true);
      const { ok, data } = await postJson("/api/stripe/connect/status", {});
      if (stopped) return;
      if (ok) {
        setAccount(Boolean(data.hasAccount));
        setEnabled(Boolean(data.payoutsEnabled));
      }
      setChecking(false);
    }
    check();
    return () => {
      stopped = true;
    };
  }, [hasAccount, payoutsEnabled, returned]);

  async function setUp() {
    setBusy(true);
    setMessage("");
    const { ok, data } = await postJson("/api/stripe/connect/onboard", {});
    if (ok && typeof data.url === "string") {
      window.location.assign(data.url);
      return;
    }
    setMessage(friendlyError(data.error));
    setBusy(false);
  }

  return (
    <div className="card">
      {message && <div className="notice notice-error">{message}</div>}

      {enabled ? (
        <>
          <span className="badge badge-success">Payouts are set up</span>
          <p className="muted">
            You&rsquo;ll be paid your share of each job when you mark it complete. Stripe sends the money
            to your bank on its normal schedule.
          </p>
        </>
      ) : (
        <>
          <span className="badge">{account ? "Setup not finished" : "Payouts not set up"}</span>
          <h2 className="pay-title">Get paid for your jobs</h2>
          <p className="muted">
            To accept jobs you need to link a bank account or debit card. This happens on
            Stripe&rsquo;s secure page, and NemaGo never sees your bank details.
          </p>
          {checking && <p className="small muted">Checking with Stripe…</p>}
          <button type="button" className="btn btn-primary" onClick={setUp} disabled={busy}>
            {busy ? "Opening Stripe…" : account ? "Continue Setting Up Payouts" : "Set Up Payouts"}
          </button>
          <small className="muted">
            Test mode: on Stripe&rsquo;s page you can use the &ldquo;use test data&rdquo; options. For a
            bank, use routing number 110000000 and account number 000123456789.
          </small>
        </>
      )}
    </div>
  );
}
