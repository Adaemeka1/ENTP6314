"use client";

import { useState } from "react";

// A pretend checkout. No real card is used, no money moves, and nothing is
// sent or saved. (Stripe's public test card number is shown read-only.)
export function PaymentBox({
  title,
  amountText,
  buttonText,
  doneText,
}: {
  title: string;
  amountText: string;
  buttonText: string;
  doneText: string;
}) {
  const [status, setStatus] = useState<"idle" | "paying" | "paid">("idle");
  const [receipt, setReceipt] = useState("");

  function pay() {
    setStatus("paying");
    setTimeout(() => {
      setReceipt("TEST-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      setStatus("paid");
    }, 1200);
  }

  return (
    <div className="card">
      <span className="badge">Test mode</span>
      <h2 className="pay-title">{title}</h2>
      <p className="pay-amount">{amountText}</p>

      {status === "paid" ? (
        <div className="notice notice-success" role="status">
          <strong>{doneText}</strong>
          <br />
          Receipt {receipt}. This was a simulation, so no real money moved.
        </div>
      ) : (
        <>
          <div className="form">
            <label>
              Test card number
              <input type="text" value="4242 4242 4242 4242" readOnly />
            </label>
            <div className="pay-row">
              <label>
                Expires
                <input type="text" value="12 / 34" readOnly />
              </label>
              <label>
                CVC
                <input type="text" value="123" readOnly />
              </label>
            </div>
            <small className="muted">
              This is Stripe&rsquo;s public test card, so you don&rsquo;t need a real one. Never
              type a real card number into a demo.
            </small>
            <button
              type="button"
              className="btn btn-primary"
              onClick={pay}
              disabled={status === "paying"}
            >
              {status === "paying" ? "Processing…" : buttonText}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
