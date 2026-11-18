// The fixed-price service menu ("I Know What I Need").
//
// `baseDollars` is the all-in base price for a Tier 1 car: NemaGo-sourced parts
// plus labor. It does NOT include the $35 dispatch fee, which is added at
// checkout. `partsShare` is the part of that price that is parts; the rest is
// labor.
//
// PLACEHOLDER: the base prices come from the owner, but the parts shares do not.
// They only decide how the price is split between "NemaGo Sourced Parts" (100%
// NemaGo) and "Tiered Labor" (90% to the mechanic), so they directly change what
// a mechanic earns. Replace them with real numbers before launch.
//
// No imports, so it runs in the browser, on the server and in tests.

export type Service = {
  id: string;
  name: string;
  baseDollars: number;
  partsShare: number;
};

export const SERVICES: Service[] = [
  { id: "oil_change", name: "Full Synthetic Oil & Filter Change", baseDollars: 85, partsShare: 0.5 },
  { id: "battery", name: "Car Battery Replacement - Parts & Labor Included", baseDollars: 210, partsShare: 0.75 },
  { id: "front_brake_pads", name: "Front Brake Pad Replacement - Parts & Labor Included", baseDollars: 195, partsShare: 0.45 },
  { id: "rear_brake_pads", name: "Rear Brake Pad Replacement - Parts & Labor Included", baseDollars: 195, partsShare: 0.45 },
  { id: "front_pads_rotors", name: "Front Brake Pads & Rotors - Parts & Labor Included", baseDollars: 360, partsShare: 0.6 },
  { id: "air_filters", name: "Engine & Cabin Air Filter Replacement - Parts & Labor Included", baseDollars: 75, partsShare: 0.55 },
  { id: "wipers", name: "Wiper Blade Replacement - Parts & Labor Included", baseDollars: 45, partsShare: 0.6 },
  { id: "bulb", name: "Exterior Bulb Replacement - Parts & Labor Included", baseDollars: 55, partsShare: 0.4 },
  { id: "serpentine_belt", name: "Serpentine Belt Replacement - Parts & Labor Included", baseDollars: 150, partsShare: 0.35 },
  { id: "pre_purchase_inspection", name: "Pre-Purchase Used Car Inspection", baseDollars: 120, partsShare: 0 },
];

export function findService(id: string | null | undefined): Service | null {
  return SERVICES.find((s) => s.id === id) ?? null;
}

// "Front Brake Pad Replacement - Parts & Labor Included" -> "Front Brake Pad Replacement"
export function shortServiceName(service: Pick<Service, "name">) {
  return service.name.replace(/ - Parts & Labor Included$/, "");
}
