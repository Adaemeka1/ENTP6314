"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckoutSummary, linesFromPriced } from "@/components/booking/CheckoutSummary";
import { PartsTrustBadge } from "@/components/booking/PartsTrustBadge";
import { TierBadge } from "@/components/booking/TierBadge";
import { EMPTY_CAR, VehicleFields, type CarForm } from "@/components/booking/VehicleFields";
import { validateBookingRequest } from "@/lib/booking";
import { friendlyError, postJson } from "@/lib/dispatch";
import { formatCents } from "@/lib/fees";
import { priceBooking, startingAtDollars, tieredPriceDollars } from "@/lib/pricing";
import { SERVICES } from "@/lib/services";
import { classifyTier } from "@/lib/vehicleTier";
import { validateCar, type Vehicle } from "@/lib/vehicles";

// Path A, "I Know What I Need": vehicle, then the fixed-price menu, then pay.
export function ServiceBooking({ vehicles }: { vehicles: Vehicle[] }) {
  const [car, setCar] = useState<CarForm>(EMPTY_CAR);
  const [serviceId, setServiceId] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 2: once the year, make and model make sense, find the pricing tier.
  const carCheck = validateCar(car);
  const tier = carCheck.ok ? classifyTier(carCheck.value) : null;
  const priced =
    carCheck.ok && serviceId
      ? priceBooking({ type: "fixed_price", serviceId, vehicle: carCheck.value })
      : null;
  const selected = SERVICES.find((s) => s.id === serviceId) ?? null;

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      type: "fixed_price",
      serviceId,
      year: car.year,
      make: car.make,
      model: car.model,
      vehicleId: car.vehicleId,
      area,
      address,
      notes,
    };
    const check = validateBookingRequest(body);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
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
          requireVin={false}
        />
        {carCheck.ok && tier && <TierBadge vehicle={carCheck.value} tier={tier} />}
      </section>

      <section className="card booking-step">
        <h2 className="step-title">
          <span className="step-number">2</span> Choose a service
        </h2>
        <p className="muted small">
          {carCheck.ok
            ? "Prices below are for your vehicle. Parts and labor are included; the $35.00 dispatch fee is added at checkout."
            : "Starting prices are for a standard car. Enter your vehicle above to see your exact price. Parts and labor are included; a $35.00 dispatch fee is added at checkout."}
        </p>
        <div className="service-menu" role="radiogroup" aria-label="Service menu">
          {SERVICES.map((service) => {
            const dollars = carCheck.ok && tier
              ? tieredPriceDollars(service.baseDollars, tier.multiplierPct)
              : null;
            const on = service.id === serviceId;
            return (
              <button
                key={service.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={"service-card" + (on ? " service-card-on" : "")}
                onClick={() => setServiceId(service.id)}
              >
                <span className="service-name">{service.name}</span>
                <span className="service-price">
                  {dollars !== null ? `$${dollars}` : `Starting at $${startingAtDollars(service)}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
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
            <label>
              Anything the mechanic should know? <span className="muted small">(optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="For example: car is in the garage, code is 1234"
                maxLength={200}
                rows={2}
              />
            </label>
          </div>
        </section>
      )}

      {selected && (
        <section className="card booking-step">
          <h2 className="step-title">
            <span className="step-number">4</span> Review and pay
          </h2>
          {priced ? (
            <>
              <CheckoutSummary lines={linesFromPriced(priced)} totalCents={priced.totalCents} />
              <PartsTrustBadge />
              <p className="muted small disclaimer">
                Not 100% sure this fixes your issue? <Link href="/driver/book/diagnosis">Book a Diagnosis instead</Link>.
                Fixed-price bookings cover the selected service only.
              </p>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Taking you to payment…" : "Pay " + formatCents(priced.totalCents) + " and book a mechanic"}
              </button>
              <p className="muted small">
                Full payment is taken up front on Stripe&rsquo;s secure page, before any mechanic is sent. Full
                refund if you cancel before your mechanic arrives. Test mode: use card 4242 4242 4242 4242.
              </p>
            </>
          ) : (
            <>
              <PartsTrustBadge />
              <p className="notice notice-error">
                Enter your vehicle&rsquo;s year, make and model in step 1 to see your exact price.
              </p>
            </>
          )}
        </section>
      )}
    </form>
  );
}
