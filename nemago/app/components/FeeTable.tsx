import {
  DISPATCH_FEE_DOLLARS,
  MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH,
  formatDollars,
} from "@/lib/fees";

// Shows who pays what. Prices come from lib/fees.ts.
export function FeeTable() {
  return (
    <div className="card">
      <strong>Who pays what</strong>
      <div className="fee-row">
        <span>
          <strong>Drivers</strong>
          <br />
          <span className="muted small">Flat dispatch fee for each request</span>
        </span>
        <span className="fee-amount">{formatDollars(DISPATCH_FEE_DOLLARS)}</span>
      </div>
      <div className="fee-row">
        <span>
          <strong>Mechanics</strong>
          <br />
          <span className="muted small">
            Monthly platform subscription, paid on the Billing page
          </span>
        </span>
        <span className="fee-amount">
          {formatDollars(MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH)}/mo
        </span>
      </div>
      <p className="muted small">Placeholder prices while the business model is still being decided.</p>
    </div>
  );
}
