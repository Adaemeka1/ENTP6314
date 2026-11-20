import { formatCents } from "@/lib/fees";
import { REPAIR_CREDIT_CENTS } from "@/lib/repair";

// The math, laid out plainly:
//   Parts Total + Labor Total - $80.00 Diagnostic Credit = Net Balance Due
export function RepairBreakdown({ partsCents, laborCents }: { partsCents: number; laborCents: number }) {
  const net = partsCents + laborCents - REPAIR_CREDIT_CENTS;
  return (
    <dl className="repair-math" aria-label="How the balance is worked out">
      <div>
        <dt>Parts Total</dt>
        <dd>{formatCents(partsCents)}</dd>
      </div>
      <div>
        <dt>+ Labor Total</dt>
        <dd>{formatCents(laborCents)}</dd>
      </div>
      <div>
        <dt>− Diagnostic Credit</dt>
        <dd>−{formatCents(REPAIR_CREDIT_CENTS)}</dd>
      </div>
      <div className="repair-math-total">
        <dt>= Net Balance Due</dt>
        <dd>{formatCents(net)}</dd>
      </div>
    </dl>
  );
}
