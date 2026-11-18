"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutSummary, linesFromPriced } from "@/components/booking/CheckoutSummary";
import { PartsTrustBadge } from "@/components/booking/PartsTrustBadge";
import { EMPTY_CAR, VehicleFields, type CarForm } from "@/components/booking/VehicleFields";
import { PhotoDropZone } from "@/components/PhotoDropZone";
import { validateBookingRequest } from "@/lib/booking";
import { friendlyError, postJson } from "@/lib/dispatch";
import { formatCents } from "@/lib/fees";
import { priceBooking } from "@/lib/pricing";
import { TRIAGE_HANDOFF_KEY, TRIAGE_HANDOFF_MAX_AGE_MS, type TriageHandoff } from "@/lib/triage";
import type { Vehicle } from "@/lib/vehicles";

const PRICED = priceBooking({ type: "diagnosis" })!;

// Path B, "Something Is Wrong": vehicle with VIN, a description, then pay the
// diagnosis fee and the dispatch fee.
export function DiagnosisBooking({
  vehicles,
  fromTriage,
  initialVehicleId,
}: {
  vehicles: Vehicle[];
  fromTriage: boolean;
  initialVehicleId: string | null;
}) {
  const [car, setCar] = useState<CarForm>(() => {
    const v = vehicles.find((x) => x.id === initialVehicleId);
    return v ? { ...EMPTY_CAR, year: String(v.year), make: v.make, model: v.model } : EMPTY_CAR;
  });
  const [description, setDescription] = useState("");
  const [triage, setTriage] = useState<TriageHandoff["triage"] | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Coming from "Report a car problem": fill in what the triage already knows.
  // The note lives in this browser tab only and expires in an hour.
  useEffect(() => {
    if (!fromTriage) return;
    try {
      const raw = sessionStorage.getItem(TRIAGE_HANDOFF_KEY);
      if (!raw) return;
      const handoff = JSON.parse(raw) as TriageHandoff;
      if (Date.now() - handoff.createdAt > TRIAGE_HANDOFF_MAX_AGE_MS) return;
      setDescription(String(handoff.description ?? "").slice(0, 300));
      setTriage(handoff.triage ?? null);
      const v = vehicles.find((x) => x.id === handoff.vehicleId);
      if (v) setCar((old) => ({ ...old, year: String(v.year), make: v.make, model: v.model }));
    } catch {
      // Unreadable note: just show the normal empty form.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTriage]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      type: "diagnosis",
      year: car.year,
      make: car.make,
      model: car.model,
      vehicleId: car.vehicleId,
      description,
      triage,
      area,
      address,
    };
    const check = validateBookingRequest(body);
    if (!check.ok) {
      setError(
        hasPhoto && description.trim().length < 3
          ? "Add a few words about the problem too. Photos aren't sent yet."
          : check.error,
      );
      return;
    }
    setBusy(true);
    try {
      sessionStorage.removeItem(TRIAGE_HANDOFF_KEY);
    } catch {
      // Nothing to clear.
    }
    const { ok, data } = await postJson("/api/checkout", body);
    if (ok && typeof data.url === "string") {
      window.location.assign(data.url);
      return;
    }
    setError(typeof data.message === "string" ? data.message : friendlyError(data.error));
    setBusy(false);
  }

  return (
    <form className="booking" onSubmit={pay}>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <section className="card booking-step">
        <h2 className="step-title">
          <span className="step-number">1</span> Your vehicle
        </h2>
        <VehicleFields
          value={car}
          onChange={(next) => setCar((old) => ({ ...old, ...next }))}
          saved={vehicles}
          requireVin
        />
      </section>

      <section className="card booking-step">
        <h2 className="step-title">
          <span className="step-number">2</span> What&rsquo;s going on?
        </h2>
        {triage && (
          <div className="triage-note">
            <p className="small">
              <strong>From your triage:</strong> {triage.likelyCause} ({triage.confidence} confidence). This is a
              demo triage, and the mechanic will confirm the real cause.
            </p>
            <button type="button" className="btn btn-google" onClick={() => setTriage(null)}>
              Remove triage note
            </button>
          </div>
        )}
        <label className="field">
          Describe the problem
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="For example: white smoke under the hood after a long drive"
            maxLength={300}
            rows={3}
            required
          />
        </label>
        <p className="muted small">{description.length} / 300</p>
        <p className="muted small">A photo helps (optional).</p>
        <PhotoDropZone onChange={setHasPhoto} />
      </section>

      <section className="card booking-step">
        <h2 className="step-title">
          <span className="step-number">3</span> Where should the mechanic come?
        </h2>
        <div className="form">
          <label>
            Your general area
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="For example: Downtown Austin"
              maxLength={80}
              required
            />
            <small className="muted">Mechanics see this before they accept.</small>
          </label>
          <label>
            Where is your car?
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address or nearest cross streets"
              maxLength={200}
              required
            />
            <small className="muted">Only the mechanic who accepts your job will see this.</small>
          </label>
        </div>
      </section>

      <section className="card booking-step">
        <h2 className="step-title">
          <span className="step-number">4</span> Review and pay
        </h2>
        <CheckoutSummary lines={linesFromPriced(PRICED)} totalCents={PRICED.totalCents} />
        <p className="diagnosis-note">
          Your mechanic gets 90% of the diagnosis fee upon arrival. If you approve the repair quote afterward,
          your $80 diagnosis fee is credited toward the total repair cost.
        </p>
        <PartsTrustBadge />
        <p className="muted small disclaimer">
          Already know what you need? <Link href="/driver/book/service">See the fixed-price menu</Link>.
        </p>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Taking you to payment…" : "Pay " + formatCents(PRICED.totalCents) + " and book a diagnosis"}
        </button>
        <p className="muted small">
          Full payment is taken up front on Stripe&rsquo;s secure page, before any mechanic is sent. Full refund if
          you cancel before your mechanic arrives. Test mode: use card 4242 4242 4242 4242.
        </p>
      </section>
    </form>
  );
}
