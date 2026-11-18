"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoDropZone } from "@/components/PhotoDropZone";
import { TriageResultCard } from "@/components/TriageResultCard";
import { friendlyError, postJson } from "@/lib/dispatch";
import {
  SYMPTOMS,
  TRIAGE_HANDOFF_KEY,
  WARNING_LIGHTS,
  type TriageHandoff,
  type TriageResult,
} from "@/lib/triage";
import { formatMileage, formatVehicle, type Vehicle } from "@/lib/vehicles";

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

// The guided "Report a car problem" screen.
export function TriageFlow({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(vehicles.length === 1 ? vehicles[0].id : "");
  const [lights, setLights] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState<{ result: TriageResult; note: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const canSubmit = lights.length > 0 || symptoms.length > 0 || description.trim().length >= 3;

  useEffect(() => {
    if (out) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [out]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, data } = await postJson("/api/triage", { lights, symptoms, description });
    if (ok && data.result) {
      setOut({ result: data.result as TriageResult, note: String(data.note ?? "") });
    } else {
      setError(
        data.error === "invalid_input"
          ? "Please pick at least one warning light or symptom, or describe the problem."
          : friendlyError(data.error),
      );
    }
    setBusy(false);
  }

  // What the request will say if the driver typed nothing: their picks, in words.
  function describeForRequest() {
    if (description.trim()) return description.trim();
    const parts: string[] = [];
    const lightNames = WARNING_LIGHTS.filter((o) => lights.includes(o.id)).map((o) => o.label.toLowerCase());
    const symptomNames = SYMPTOMS.filter((o) => symptoms.includes(o.id)).map((o) => o.label.toLowerCase());
    if (lightNames.length) parts.push("Warning light: " + lightNames.join(", "));
    if (symptomNames.length) parts.push("Symptoms: " + symptomNames.join(", "));
    return parts.join(". ");
  }

  function book() {
    if (!out) return;
    const handoff: TriageHandoff = {
      vehicleId: vehicle?.id ?? null,
      description: describeForRequest(),
      triage: { likelyCause: out.result.likelyCause, confidence: out.result.confidence.level },
      createdAt: Date.now(),
    };
    try {
      sessionStorage.setItem(TRIAGE_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      // Private mode can block storage: the request screen still works, just not prefilled.
    }
    router.push("/driver/book/diagnosis?from=triage" + (vehicle ? "&vehicle=" + encodeURIComponent(vehicle.id) : ""));
  }

  return (
    <div>
      {out && (
        <div ref={resultRef}>
          <TriageResultCard
            result={out.result}
            note={out.note}
            vehicleLabel={vehicle ? formatVehicle(vehicle) + ", " + formatMileage(vehicle.mileage) : null}
            hasPhoto={hasPhoto}
            onBook={book}
          />
          <button type="button" className="btn btn-google result-again" onClick={() => setOut(null)}>
            Change my answers
          </button>
        </div>
      )}

      <form className="form triage-form" onSubmit={submit} hidden={out !== null}>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        <section className="card triage-step">
          <h2 className="step-title">
            <span className="step-number">1</span> Which car?
          </h2>
          {vehicles.length > 0 ? (
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-label="Which car?">
              <option value="">Skip for now</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVehicle(v)} · {formatMileage(v.mileage)}
                </option>
              ))}
            </select>
          ) : (
            <p className="muted small">
              You haven&rsquo;t saved a car yet. <Link href="/driver/vehicles">Add a car</Link> to include it
              in your request, or skip this step.
            </p>
          )}
        </section>

        <section className="card triage-step">
          <h2 className="step-title">
            <span className="step-number">2</span> Show us the problem
          </h2>
          <PhotoDropZone onChange={setHasPhoto} />
        </section>

        <section className="card triage-step">
          <h2 className="step-title">
            <span className="step-number">3</span> Any warning lights on?
          </h2>
          <div className="chip-group" role="group" aria-label="Warning lights">
            {WARNING_LIGHTS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={"chip" + (lights.includes(o.id) ? " chip-on" : "")}
                aria-pressed={lights.includes(o.id)}
                onClick={() => setLights((prev) => toggle(prev, o.id))}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card triage-step">
          <h2 className="step-title">
            <span className="step-number">4</span> What do you notice?
          </h2>
          <div className="chip-group" role="group" aria-label="Symptoms">
            {SYMPTOMS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={"chip" + (symptoms.includes(o.id) ? " chip-on" : "")}
                aria-pressed={symptoms.includes(o.id)}
                onClick={() => setSymptoms((prev) => toggle(prev, o.id))}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card triage-step">
          <h2 className="step-title">
            <span className="step-number">5</span> Tell us more <span className="muted small">(optional)</span>
          </h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="For example: white smoke under the hood after a long drive"
            maxLength={300}
            rows={3}
            aria-label="Describe the problem"
          />
          <p className="muted small">{description.length} / 300</p>
        </section>

        <button type="submit" className="btn btn-primary" disabled={busy || !canSubmit}>
          {busy ? "Working it out…" : "Get my triage"}
        </button>
        {!canSubmit && (
          <p className="muted small">Pick a warning light or a symptom, or describe the problem, to continue.</p>
        )}
      </form>
    </div>
  );
}
