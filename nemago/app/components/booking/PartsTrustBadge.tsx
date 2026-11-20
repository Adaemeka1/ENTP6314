// The parts policy, shown on every checkout screen. NemaGo sources ALL parts itself
// through commercial accounts (the warranty is the manufacturer's): customers never
// supply parts and mechanics never pay for parts out of pocket.
export function PartsTrustBadge() {
  return (
    <div className="trust-banner" role="note">
      <span className="badge badge-success">Parts policy</span>
      <p>
        All parts are sourced directly by NemaGo using commercial-grade OEM/equivalent
        components matched to your VIN and backed by the manufacturer&apos;s warranty.
      </p>
    </div>
  );
}
