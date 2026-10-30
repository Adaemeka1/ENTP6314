import {
  MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH,
  PLATFORM_FEE_PERCENT,
  SERVICE_PRICE_CENTS,
  formatCents,
  formatDollars,
  mechanicShareCents,
  platformFeeCents,
} from "@/lib/fees";

// Shows who pays what. Prices come from lib/fees.ts.
export function FeeTable() {
  const fee = platformFeeCents(SERVICE_PRICE_CENTS);
  return (
    <div className="card">
      <strong>Who pays what</strong>
      <div className="fee-row">
        <span>
          <strong>Drivers</strong>
          <br />
          <span className="muted small">Flat price for each roadside dispatch, paid by card</span>
        </span>
        <span className="fee-amount">{formatCents(SERVICE_PRICE_CENTS)}</span>
      </div>
      <div className="fee-row">
        <span>
          <strong>Mechanics earn</strong>
          <br />
          <span className="muted small">
            Their share of each job, after the {PLATFORM_FEE_PERCENT}% NemaGo service fee
          </span>
        </span>
        <span className="fee-amount">
          {formatCents(mechanicShareCents(SERVICE_PRICE_CENTS, fee))}
        </span>
      </div>
      <div className="fee-row">
        <span>
          <strong>Mechanic subscription</strong>
          <br />
          <span className="muted small">Pretend billing screen for now</span>
        </span>
        <span className="fee-amount">
          {formatDollars(MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH)}/mo
        </span>
      </div>
      <p className="muted small">Placeholder prices while the business model is still being decided.</p>
    </div>
  );
}
