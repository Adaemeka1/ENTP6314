import {
  DIAGNOSTIC_FEE_CENTS,
  DIAGNOSTIC_FEE_LABEL,
  DISPATCH_FEE_CENTS,
  DISPATCH_FEE_LABEL,
  MECHANIC_SUBSCRIPTION_DOLLARS_PER_MONTH,
  SERVICE_PRICE_CENTS,
  formatCents,
  formatDollars,
  mechanicShareCents,
  platformFeeCents,
} from "@/lib/fees";

// Shows who pays what. Prices come from lib/fees.ts.
export function FeeTable() {
  return (
    <div className="card">
      <strong>Who pays what</strong>
      <div className="fee-row">
        <span>
          <strong>Drivers pay</strong>
          <br />
          <span className="muted small">
            {DISPATCH_FEE_LABEL} {formatCents(DISPATCH_FEE_CENTS)} + {DIAGNOSTIC_FEE_LABEL}{" "}
            {formatCents(DIAGNOSTIC_FEE_CENTS)}, by card
          </span>
        </span>
        <span className="fee-amount">{formatCents(SERVICE_PRICE_CENTS)}</span>
      </div>
      <div className="fee-row">
        <span>
          <strong>Mechanics receive</strong>
          <br />
          <span className="muted small">
            The {DIAGNOSTIC_FEE_LABEL} for each job, once a diagnosis is recorded
          </span>
        </span>
        <span className="fee-amount">
          {formatCents(mechanicShareCents(SERVICE_PRICE_CENTS, platformFeeCents()))}
        </span>
      </div>
      <div className="fee-row">
        <span>
          <strong>NemaGo keeps</strong>
          <br />
          <span className="muted small">The {DISPATCH_FEE_LABEL}</span>
        </span>
        <span className="fee-amount">{formatCents(platformFeeCents())}</span>
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
    </div>
  );
}
