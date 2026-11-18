import { tierBadgeText, type TierInfo } from "@/lib/vehicleTier";

// "Pricing adjusted for: 2021 Ford F-150 — Truck/SUV Tier"
export function TierBadge({
  vehicle,
  tier,
}: {
  vehicle: { year: number; make: string; model: string };
  tier: TierInfo;
}) {
  return (
    <p className="tier-badge" role="status">
      <span className="badge badge-success">
        Pricing adjusted for: {tierBadgeText(vehicle, tier)}
      </span>
      <span className="muted small">
        {tier.multiplierPct === 100 ? "Standard pricing" : (tier.multiplierPct / 100).toFixed(2) + "× standard pricing"}
      </span>
    </p>
  );
}
