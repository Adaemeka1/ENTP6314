import { DIAGNOSTIC_FEE_CENTS, DISPATCH_FEE_CENTS, SERVICE_PRICE_CENTS, formatCents } from "@/lib/fees";
import type { TriageResult } from "@/lib/triage";

// The structured Triage Result: safety first, then cause, confidence and service.
export function TriageResultCard({
  result,
  note,
  vehicleLabel,
  hasPhoto,
  onBook,
}: {
  result: TriageResult;
  note: string;
  vehicleLabel: string | null;
  hasPhoto: boolean;
  onBook: () => void;
}) {
  const confidenceTone =
    result.confidence.level === "High" ? "good" : result.confidence.level === "Medium" ? "neutral" : "warn";

  return (
    <div className="card triage-result" aria-live="polite">
      <div className="triage-head">
        <h2 className="pay-title">Your triage result</h2>
        <span className="badge badge-demo">Demo triage</span>
      </div>

      <div className={"safety-banner safety-banner-" + result.safety.call} role="status">
        <p className="safety-banner-label">Safety call: {result.safety.label}</p>
        <p className="safety-banner-detail">{result.safety.detail}</p>
      </div>

      <dl className="triage-facts">
        <div>
          <dt>Likely cause</dt>
          <dd>{result.likelyCause}</dd>
        </div>
        <div>
          <dt>Confidence level</dt>
          <dd>
            <span className={"match-tag match-tag-" + confidenceTone}>{result.confidence.level}</span>
            <span className="muted small triage-reason">{result.confidence.reason}</span>
          </dd>
        </div>
        <div>
          <dt>Recommended service</dt>
          <dd>{result.recommendedService}</dd>
        </div>
      </dl>

      {result.alternatives.length > 0 && (
        <p className="small">
          <strong>Other possibilities:</strong> {result.alternatives.join("; ")}
        </p>
      )}

      <div className="triage-steps">
        <p className="small">
          <strong>What to do now</strong>
        </p>
        <ul>
          {result.nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>

      {(vehicleLabel || hasPhoto || result.signalsUsed.length > 0) && (
        <details className="match-details">
          <summary>What this is based on</summary>
          <ul className="triage-used">
            {vehicleLabel && <li>Vehicle: {vehicleLabel}</li>}
            {result.signalsUsed.map((s) => (
              <li key={s}>{s}</li>
            ))}
            {hasPhoto && <li>Photo: kept on your device and not analysed in this demo</li>}
          </ul>
        </details>
      )}

      <p className="match-demo-note">{note}</p>

      <button type="button" className="btn btn-primary" onClick={onBook}>
        Book Certified Mechanic · {formatCents(SERVICE_PRICE_CENTS)}
      </button>
      <p className="muted small triage-price-note">
        {formatCents(DISPATCH_FEE_CENTS)} dispatch fee + {formatCents(DIAGNOSTIC_FEE_CENTS)} diagnostic fee,
        locked before you pay. Full refund if you cancel before the mechanic records a diagnosis.
      </p>
    </div>
  );
}
