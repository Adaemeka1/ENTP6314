import {
  DIAGNOSTIC_FEE_CENTS,
  DISPATCH_FEE_CENTS,
  DISPATCH_FEE_LABEL,
  MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH,
  formatCents,
  formatDollars,
} from "@/lib/fees";
import { MECHANIC_PERCENT } from "@/lib/pricing";

// Shows who gets what. Percentages and prices come from lib/pricing.ts and lib/fees.ts.
export function FeeTable() {
  return (
    <div className="card">
      <strong>How every job is split</strong>
      <div className="fee-row">
        <span>
          <strong>{DISPATCH_FEE_LABEL}</strong>
          <br />
          <span className="muted small">100% NemaGo&rsquo;s, on every job</span>
        </span>
        <span className="fee-amount">{formatCents(DISPATCH_FEE_CENTS)}</span>
      </div>
      <div className="fee-row">
        <span>
          <strong>Parts</strong>
          <br />
          <span className="muted small">
            NemaGo buys and warranties every part. You never pay for parts or wait to be reimbursed.
          </span>
        </span>
        <span className="fee-amount">$0.00</span>
      </div>
      <div className="fee-row">
        <span>
          <strong>Labor and diagnosis: you receive</strong>
          <br />
          <span className="muted small">
            {MECHANIC_PERCENT}% of the labor or diagnosis total (NemaGo keeps {100 - MECHANIC_PERCENT}%). On a
            diagnosis visit that is {formatCents(Math.round((DIAGNOSTIC_FEE_CENTS * MECHANIC_PERCENT) / 100))}
            , paid when you arrive.
          </span>
        </span>
        <span className="fee-amount">{MECHANIC_PERCENT}%</span>
      </div>
      <div className="fee-row">
        <span>
          <strong>Mechanic subscription</strong>
          <br />
          <span className="muted small">Pretend billing screen for now</span>
        </span>
        <span className="fee-amount">{formatDollars(MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH)}/mo</span>
      </div>
    </div>
  );
}
