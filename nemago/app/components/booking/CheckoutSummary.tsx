import { DIAGNOSTIC_FEE_LABEL, DISPATCH_FEE_LABEL, formatCents } from "@/lib/fees";
import type { Priced } from "@/lib/pricing";
import { shortServiceName } from "@/lib/services";

export type SummaryLine = { label: string; note?: string; cents: number };

// The itemized lines for a priced booking.
export function linesFromPriced(priced: Priced): SummaryLine[] {
  if (priced.type === "fixed_price" && priced.service && priced.tier) {
    return [
      {
        label: "Tiered Labor",
        note: `${shortServiceName(priced.service)} · ${priced.tier.label}`,
        cents: priced.laborAndDiagCents,
      },
      {
        label: "NemaGo Sourced Parts",
        note:
          priced.partsCents > 0
            ? "Commercial-grade OEM/equivalent, manufacturer's warranty"
            : "No parts needed for this service",
        cents: priced.partsCents,
      },
      { label: DISPATCH_FEE_LABEL, cents: priced.dispatchFeeCents },
    ];
  }
  return [
    { label: DIAGNOSTIC_FEE_LABEL, note: "On-site diagnosis", cents: priced.laborAndDiagCents },
    { label: DISPATCH_FEE_LABEL, cents: priced.dispatchFeeCents },
  ];
}

// The same lines from what the database stored for a job.
export function linesFromTransaction(
  tx: { dispatch_fee_cents: number; parts_total_cents: number; labor_and_diag_total_cents: number },
  bookingType: "diagnosis" | "fixed_price",
): SummaryLine[] {
  if (bookingType === "fixed_price") {
    return [
      { label: "Tiered Labor", cents: tx.labor_and_diag_total_cents },
      { label: "NemaGo Sourced Parts", cents: tx.parts_total_cents },
      { label: DISPATCH_FEE_LABEL, cents: tx.dispatch_fee_cents },
    ];
  }
  return [
    { label: DIAGNOSTIC_FEE_LABEL, cents: tx.labor_and_diag_total_cents },
    { label: DISPATCH_FEE_LABEL, cents: tx.dispatch_fee_cents },
  ];
}

// An itemized price box with a total.
export function CheckoutSummary({
  lines,
  totalCents,
  title = "Checkout summary",
  badge = "Price locked",
}: {
  lines: SummaryLine[];
  totalCents: number;
  title?: string;
  badge?: string | null;
}) {
  return (
    <div className="price-box price-breakdown">
      <div className="price-lock">
        <strong>{title}</strong>
        {badge && <span className="badge badge-success">{badge}</span>}
      </div>
      {lines.map((line) => (
        <div key={line.label} className="price-line">
          <span>
            {line.label}
            {line.note && <small className="line-note">{line.note}</small>}
          </span>
          <strong>{formatCents(line.cents)}</strong>
        </div>
      ))}
      <div className="price-line price-total">
        <span>Total</span>
        <strong>{formatCents(totalCents)}</strong>
      </div>
    </div>
  );
}
