"use client";

import { formatMileage, formatVehicle, type Vehicle } from "@/lib/vehicles";

export type CarForm = { year: string; make: string; model: string; vehicleId: string };

export const EMPTY_CAR: CarForm = { year: "", make: "", model: "", vehicleId: "" };

// Year, make, model and VIN (or license plate). Saved cars can fill in the first three.
export function VehicleFields({
  value,
  onChange,
  saved,
  requireVin,
}: {
  value: CarForm;
  onChange: (next: Partial<CarForm>) => void;
  saved: Vehicle[];
  requireVin: boolean;
}) {
  return (
    <div className="form">
      {saved.length > 0 && (
        <label>
          Use a saved car (optional)
          <select
            value=""
            onChange={(e) => {
              const car = saved.find((v) => v.id === e.target.value);
              if (car) onChange({ year: String(car.year), make: car.make, model: car.model });
            }}
          >
            <option value="">Choose a saved car…</option>
            {saved.map((v) => (
              <option key={v.id} value={v.id}>
                {formatVehicle(v)} · {formatMileage(v.mileage)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="vehicle-grid">
        <label>
          Year
          <input
            type="text"
            inputMode="numeric"
            value={value.year}
            onChange={(e) => onChange({ year: e.target.value })}
            placeholder="2021"
            maxLength={4}
            autoComplete="off"
            required
          />
        </label>
        <label>
          Make
          <input
            type="text"
            value={value.make}
            onChange={(e) => onChange({ make: e.target.value })}
            placeholder="Ford"
            maxLength={40}
            autoComplete="off"
            required
          />
        </label>
      </div>
      <label>
        Model
        <input
          type="text"
          value={value.model}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder="F-150"
          maxLength={60}
          autoComplete="off"
          required
        />
      </label>
      <label>
        {requireVin ? "VIN" : "VIN or license plate"}
        <input
          type="text"
          value={value.vehicleId}
          onChange={(e) => onChange({ vehicleId: e.target.value })}
          placeholder={requireVin ? "17-character VIN" : "17-character VIN or plate, for example ABC-1234"}
          maxLength={24}
          autoCapitalize="characters"
          autoComplete="off"
          required
        />
        <small className="muted">
          {requireVin
            ? "Found on your dashboard by the windshield, or on your insurance card. We use it to match your parts."
            : "We use it to match your parts exactly to your vehicle."}
        </small>
      </label>
    </div>
  );
}
