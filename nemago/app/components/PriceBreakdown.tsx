import {
  DIAGNOSTIC_FEE_CENTS,
  DIAGNOSTIC_FEE_LABEL,
  DISPATCH_FEE_CENTS,
  DISPATCH_FEE_LABEL,
  SERVICE_PRICE_CENTS,
  formatCents,
} from "@/lib/fees";

// The $115.00 split into its two fees. Shown on the driver's screens.
export function PriceBreakdown() {
  return (
    <div className="price-box price-breakdown">
      <div className="price-line">
        <span>{DISPATCH_FEE_LABEL}</span>
        <strong>{formatCents(DISPATCH_FEE_CENTS)}</strong>
      </div>
      <div className="price-line">
        <span>{DIAGNOSTIC_FEE_LABEL}</span>
        <strong>{formatCents(DIAGNOSTIC_FEE_CENTS)}</strong>
      </div>
      <div className="price-line price-total">
        <span>Total</span>
        <strong>{formatCents(SERVICE_PRICE_CENTS)}</strong>
      </div>
      <p className="muted small">
        The {formatCents(DIAGNOSTIC_FEE_CENTS)} diagnostic fee pays the mechanic for diagnosing your car
        on site (or is credited toward the repair). If you cancel before the mechanic records a
        diagnosis, you get all {formatCents(SERVICE_PRICE_CENTS)} back. After a diagnosis is recorded,
        the {formatCents(DISPATCH_FEE_CENTS)} dispatch fee stays with NemaGo and the{" "}
        {formatCents(DIAGNOSTIC_FEE_CENTS)} goes to the mechanic.
      </p>
    </div>
  );
}
