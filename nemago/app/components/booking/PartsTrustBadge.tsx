// The parts policy, shown on every checkout screen. NemaGo buys and warranties
// ALL parts itself through commercial accounts: customers never supply parts and
// mechanics never pay for parts out of pocket.
export function PartsTrustBadge() {
  return (
    <div className="trust-banner" role="note">
      <span className="badge badge-success">Parts policy</span>
      <p>
        All parts are sourced and warranty-backed directly by NemaGo using commercial-grade OEM/equivalent
        components matched to your VIN.
      </p>
    </div>
  );
}
