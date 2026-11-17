"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_VEHICLES,
  formatMileage,
  formatVehicle,
  validateVehicle,
  type Vehicle,
} from "@/lib/vehicles";

const COLUMNS = "id, year, make, model, mileage";

function saveError(message: string | undefined) {
  if (message && message.includes("vehicle_limit")) {
    return `You can save up to ${MAX_VEHICLES} cars. Remove one first.`;
  }
  return "We couldn't save that. Please check it and try again.";
}

// One saved car, with a small "update mileage" form and a remove button.
function VehicleCard({
  vehicle,
  onChanged,
  onRemoved,
}: {
  vehicle: Vehicle;
  onChanged: (v: Vehicle) => void;
  onRemoved: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [mileage, setMileage] = useState(String(vehicle.mileage));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function saveMileage(e: React.FormEvent) {
    e.preventDefault();
    const check = validateVehicle({ ...vehicle, mileage });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: failure } = await createClient()
      .from("vehicles")
      .update({ mileage: check.value.mileage })
      .eq("id", vehicle.id)
      .select(COLUMNS)
      .single();
    setBusy(false);
    if (failure || !data) {
      setError(saveError(failure?.message));
      return;
    }
    onChanged(data as Vehicle);
    setEditing(false);
  }

  async function remove() {
    if (!window.confirm(`Remove your ${formatVehicle(vehicle)}?`)) return;
    setBusy(true);
    setError("");
    const { error: failure } = await createClient().from("vehicles").delete().eq("id", vehicle.id);
    setBusy(false);
    if (failure) {
      setError("We couldn't remove that. Please try again.");
      return;
    }
    onRemoved(vehicle.id);
  }

  return (
    <div className="card vehicle-card">
      <div className="vehicle-head">
        <div>
          <strong className="vehicle-name">{formatVehicle(vehicle)}</strong>
          <p className="muted small">{formatMileage(vehicle.mileage)}</p>
        </div>
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {editing ? (
        <form className="vehicle-edit" onSubmit={saveMileage}>
          <label>
            Current mileage
            <input
              type="text"
              inputMode="numeric"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              aria-label="Current mileage"
              required
            />
          </label>
          <div className="vehicle-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save mileage"}
            </button>
            <button type="button" className="btn btn-google" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="vehicle-actions">
          <button type="button" className="btn btn-google" onClick={() => setEditing(true)} disabled={busy}>
            Update mileage
          </button>
          <button type="button" className="btn btn-google" onClick={remove} disabled={busy}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// The "My vehicles" screen: add a car, see saved cars, update mileage, remove.
export function VehicleManager({
  driverId,
  initial,
  setupProblem,
}: {
  driverId: string;
  initial: Vehicle[];
  setupProblem: boolean;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initial);
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaved("");
    const check = validateVehicle({ year, make, model, mileage });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: failure } = await createClient()
      .from("vehicles")
      .insert({ driver_id: driverId, ...check.value })
      .select(COLUMNS)
      .single();
    setBusy(false);
    if (failure || !data) {
      setError(saveError(failure?.message));
      return;
    }
    setVehicles((old) => [...old, data as Vehicle]);
    setSaved(formatVehicle(data as Vehicle) + " saved.");
    setYear("");
    setMake("");
    setModel("");
    setMileage("");
  }

  if (setupProblem) {
    return (
      <div className="notice notice-error">
        Vehicles aren&rsquo;t set up yet. Please try again later. (The database file for vehicles still needs
        to be run.)
      </div>
    );
  }

  return (
    <div>
      {vehicles.length === 0 ? (
        <div className="card">
          <strong>No cars saved yet</strong>
          <p className="muted">
            Add your car below. It makes triage and mechanic requests faster, and the mechanic knows
            exactly what they&rsquo;re working on.
          </p>
        </div>
      ) : (
        vehicles.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            onChanged={(next) => setVehicles((old) => old.map((x) => (x.id === next.id ? next : x)))}
            onRemoved={(id) => setVehicles((old) => old.filter((x) => x.id !== id))}
          />
        ))
      )}

      {vehicles.length < MAX_VEHICLES ? (
        <form className="card form" onSubmit={add}>
          <h2 className="pay-title">Add a car</h2>
          {saved && <p className="notice notice-success">{saved}</p>}
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <div className="vehicle-grid">
            <label>
              Year
              <input
                type="text"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2018"
                maxLength={4}
                required
              />
            </label>
            <label>
              Make
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Honda"
                maxLength={40}
                required
              />
            </label>
          </div>
          <label>
            Model
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Civic"
              maxLength={60}
              required
            />
          </label>
          <label>
            Current mileage
            <input
              type="text"
              inputMode="numeric"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="62000"
              required
            />
            <small className="muted">A rough number is fine.</small>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save car"}
          </button>
        </form>
      ) : (
        <p className="muted small">You&rsquo;ve saved the most cars you can ({MAX_VEHICLES}). Remove one to add another.</p>
      )}
    </div>
  );
}
