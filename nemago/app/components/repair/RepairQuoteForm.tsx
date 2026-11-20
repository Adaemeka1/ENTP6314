"use client";

import { useState } from "react";
import { DemoPhoto } from "@/components/repair/DemoPhoto";
import { RepairBreakdown } from "@/components/repair/RepairBreakdown";
import { friendlyError } from "@/lib/dispatch";
import { formatCents } from "@/lib/fees";
import {
  DEMO_PHOTOS,
  MAX_DAYS_AHEAD,
  MAX_DESCRIPTION,
  MAX_SUMMARY,
  REPAIR_WINDOWS,
  addDays,
  parseDollars,
  quoteProblem,
  repairMath,
  todayInDallas,
} from "@/lib/repair";
import { MECHANIC_PERCENT } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/client";

// "Send Repair Quote": the mechanic's form after recording a diagnosis on a diagnosis job.
export function RepairQuoteForm({
  requestId,
  disabled,
  onSent,
  onError,
}: {
  requestId: string;
  disabled: boolean;
  onSent: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const today = todayInDallas();
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [photoId, setPhotoId] = useState("");
  const [parts, setParts] = useState("");
  const [labor, setLabor] = useState("");
  const [date, setDate] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  const partsCents = parts.trim() === "" ? null : parseDollars(parts);
  const laborCents = parseDollars(labor);
  const ready = partsCents !== null && laborCents !== null && laborCents >= 8000;
  const math = ready ? repairMath(partsCents, laborCents) : null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const issue = quoteProblem(
      { summary, description, photoId, partsCents, laborCents, date, windowStart },
      today,
    );
    if (issue) {
      setProblem(issue);
      return;
    }
    setProblem("");
    if (
      !window.confirm(
        "Send this quote to the driver? You can't change it after it's sent. They can approve and pay, or decline.",
      )
    ) {
      return;
    }
    setSaving(true);
    const { error } = await createClient().rpc("submit_repair_quote", {
      p_request_id: requestId,
      p_issue_summary: summary.trim(),
      p_repair_description: description.trim(),
      p_photo_id: photoId,
      p_parts_cents: partsCents,
      p_labor_cents: laborCents,
      p_repair_date: date,
      p_window_start: windowStart,
    });
    if (error) onError(friendlyError(error.message));
    await onSent();
    setSaving(false);
  }

  return (
    <form className="form quote-form" onSubmit={send} aria-labelledby={"quote-title-" + requestId}>
      <h3 id={"quote-title-" + requestId} className="gate-title">
        Send Repair Quote
      </h3>
      <p className="muted small">
        Need to fix what you found? Send the driver a quote. They approve and pay the balance, or decline.
      </p>
      {problem && <div className="notice notice-error">{problem}</div>}

      <label>
        Issue summary
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={MAX_SUMMARY}
          placeholder="For example: front brake pads worn down to the metal"
          required
        />
      </label>

      <label>
        Required repair
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          placeholder="Replace both front pads and resurface the rotors. About 2 hours."
          required
        />
      </label>

      <div>
        <p className="rate-label">Photo proof</p>
        <div className="photo-picker" role="radiogroup" aria-label="Photo proof">
          {DEMO_PHOTOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={photoId === p.id}
              className={"photo-option" + (photoId === p.id ? " photo-option-on" : "")}
              onClick={() => setPhotoId(p.id)}
            >
              <DemoPhoto id={p.id} />
            </button>
          ))}
        </div>
        <p className="muted small">
          Demo photos for now: real photo upload isn&rsquo;t switched on yet. Pick the one that matches the repair.
        </p>
      </div>

      <div className="pay-row">
        <label>
          Parts total ($)
          <input
            type="text"
            inputMode="decimal"
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            placeholder="120.00"
            autoComplete="off"
            required
          />
        </label>
        <label>
          Labor total ($)
          <input
            type="text"
            inputMode="decimal"
            value={labor}
            onChange={(e) => setLabor(e.target.value)}
            placeholder="200.00"
            autoComplete="off"
            required
          />
        </label>
      </div>
      <p className="muted small">
        NemaGo buys every part and the manufacturer&rsquo;s warranty covers it, so you never pay for parts. Enter the
        parts total the driver should be quoted (0 if none). Labor includes the {formatCents(8000)} diagnosis you
        already did, which is credited to the driver.
      </p>

      <div className="pay-row">
        <label>
          Repair date
          <input
            type="date"
            value={date}
            min={today}
            max={addDays(today, MAX_DAYS_AHEAD)}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          Time window
          <select value={windowStart} onChange={(e) => setWindowStart(e.target.value)} required>
            <option value="">Choose…</option>
            {REPAIR_WINDOWS.map((w) => (
              <option key={w.start} value={w.start}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {math && (
        <div className="quote-preview" aria-live="polite">
          <RepairBreakdown partsCents={math.partsCents} laborCents={math.laborCents} />
          <p className="small">
            <strong>
              You receive {formatCents(math.mechanicPayoutCents)} when you mark the repair complete
            </strong>{" "}
            ({MECHANIC_PERCENT}% of labor beyond the {formatCents(math.creditCents)} you were already paid for).
            Parts are NemaGo&rsquo;s.
          </p>
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={disabled || saving}>
        {saving ? "Sending…" : "Send Repair Quote"}
      </button>
    </form>
  );
}
