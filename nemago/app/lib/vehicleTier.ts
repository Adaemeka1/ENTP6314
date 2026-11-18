// Vehicle pricing tiers for fixed-price services.
//   Tier 1  Standard Cars & Compacts                1.00x
//   Tier 2  Trucks, Full-Size SUVs & Vans            1.25x
//   Tier 3  Luxury & European Vehicles               1.50x
//
// The tier comes from the make and model the customer types. The lists below are
// PLACEHOLDER rules (see the PRD's open decisions): edit them here and every
// screen and the server follow. A luxury or European make always wins, so a
// Cadillac Escalade is Tier 3, not Tier 2. An unknown make or model is Tier 1.
//
// No imports, so it runs in the browser, on the server and in tests.

export type Tier = 1 | 2 | 3;

export type TierInfo = {
  tier: Tier;
  label: string;
  // Multiplier in hundredths: 100 = 1.00x, 125 = 1.25x, 150 = 1.50x.
  multiplierPct: number;
};

export const TIERS: Record<Tier, TierInfo> = {
  1: { tier: 1, label: "Standard Car Tier", multiplierPct: 100 },
  2: { tier: 2, label: "Truck/SUV Tier", multiplierPct: 125 },
  3: { tier: 3, label: "Luxury/European Tier", multiplierPct: 150 },
};

// Compare on lowercase letters and digits only, so "F-150", "f 150" and "F150" match.
function key(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Makes that are luxury or European. Matched from the start of the make.
const LUXURY_OR_EUROPEAN_MAKES = [
  "bmw", "mercedes", "benz", "audi", "lexus", "porsche", "jaguar", "landrover", "rangerover",
  "volvo", "mini", "alfa", "maserati", "bentley", "rollsroyce", "ferrari", "lamborghini",
  "astonmartin", "mclaren", "lotus", "genesis", "infiniti", "acura", "cadillac", "lincoln",
  "volkswagen", "vw", "saab", "smart", "fiat", "peugeot", "renault", "citroen", "skoda", "seat",
];

// Pickup trucks, full-size SUVs and vans. Matched from the start of the model.
const TRUCK_SUV_VAN_MODELS = [
  // pickups
  "f150", "f250", "f350", "f450", "ranger", "maverick", "silverado", "colorado", "sierra",
  "canyon", "ram", "tundra", "tacoma", "frontier", "titan", "ridgeline", "gladiator", "santacruz",
  // full-size SUVs
  "tahoe", "suburban", "yukon", "expedition", "sequoia", "armada", "wagoneer", "grandwagoneer",
  "landcruiser", "durango",
  // vans
  "transit", "promaster", "express", "savana", "nv200", "nv1500", "nv2500", "nv3500",
  "odyssey", "sienna", "pacifica", "caravan", "grandcaravan", "carnival", "voyager", "quest", "sedona",
];

// Makes that only sell trucks and vans (so any model counts).
const TRUCK_VAN_MAKES = ["ram"];

export type TierResult = TierInfo & { reason: string };

export function classifyTier(vehicle: { make: string; model: string }): TierResult {
  const make = key(vehicle.make);
  const model = key(vehicle.model);

  if (make && LUXURY_OR_EUROPEAN_MAKES.some((m) => make.startsWith(m))) {
    return { ...TIERS[3], reason: "Luxury or European make" };
  }
  if (
    (make && TRUCK_VAN_MAKES.some((m) => make.startsWith(m))) ||
    (model && TRUCK_SUV_VAN_MODELS.some((m) => model.startsWith(m)))
  ) {
    return { ...TIERS[2], reason: "Truck, full-size SUV or van" };
  }
  return { ...TIERS[1], reason: "Standard car or compact" };
}

// "2021 Ford F-150 — Truck/SUV Tier"
export function tierBadgeText(vehicle: { year: number; make: string; model: string }, tier: TierInfo) {
  return `${vehicle.year} ${vehicle.make.trim()} ${vehicle.model.trim()} — ${tier.label}`;
}
