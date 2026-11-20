"use client";

import { useCallback, useEffect, useState } from "react";
import { friendlyError, postJson } from "@/lib/dispatch";
import { formatCents } from "@/lib/fees";
import {
  MAX_COMMENT_LENGTH,
  MAX_TIP_CENTS,
  MIN_TIP_CENTS,
  REVIEW_TAGS,
  TIP_NOTE,
  TIP_PRESETS_CENTS,
  dollarsToCents,
  type ReviewTagId,
} from "@/lib/review";
import { createClient } from "@/lib/supabase/client";

type SavedReview = {
  rating: number;
  tags: string[];
  comment: string | null;
  tip_cents: number;
  tip_status: "none" | "pending" | "paid" | "sent";
};

// "Rate & Tip Your Mechanic": shown on the driver's screen once a job is completed.
// Saves a 1 to 5 star rating, quick tags and an optional comment, and lets the driver
// tip. A tip is paid through Stripe and goes 100% to the mechanic. If the review
// database file (reviews.sql) hasn't been run yet, the card quietly hides itself.
export function RateTipCard({
  requestId,
  mechanicName,
  checkout,
}: {
  requestId: string;
  mechanicName: string | null;
  checkout?: string;
}) {
  const name = mechanicName ?? "your mechanic";

  // undefined = still loading, null = no review yet.
  const [review, setReview] = useState<SavedReview | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);

  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<ReviewTagId[]>([]);
  const [comment, setComment] = useState("");
  const [preset, setPreset] = useState<number | "custom">(0);
  const [customText, setCustomText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("job_reviews")
      .select("rating, tags, comment, tip_cents, tip_status")
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    setReview((data as SavedReview | null) ?? null);
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load, checkout]);

  // While a tip is on its way, look again every few seconds.
  const waiting = review?.tip_status === "pending" || review?.tip_status === "paid";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const customCents = preset === "custom" ? dollarsToCents(customText) : null;
  const tipCents = preset === "custom" ? (customCents ?? 0) : preset;
  const customBad =
    preset === "custom" &&
    customText.trim() !== "" &&
    (customCents === null || customCents < MIN_TIP_CENTS || customCents > MAX_TIP_CENTS);
  const customMissing = preset === "custom" && customText.trim() === "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0 || customBad || customMissing) return;
    setBusy(true);
    setMessage("");
    const { ok, data } = await postJson("/api/review", {
      requestId,
      rating,
      tags,
      comment,
      tipCents,
    });
    if (!ok) {
      setMessage(
        data.error === "already_reviewed"
          ? "You've already reviewed this job."
          : typeof data.message === "string"
            ? data.message
            : friendlyError(data.error),
      );
      await load();
      setBusy(false);
      return;
    }
    if (typeof data.url === "string") {
      window.location.assign(data.url);
      return;
    }
    if (data.tip_error) {
      setMessage("Your review is saved, but we couldn't open the tip payment. You can try the tip again below.");
    }
    await load();
    setBusy(false);
  }

  async function payTip() {
    setBusy(true);
    setMessage("");
    const { ok, data } = await postJson("/api/tip", { requestId });
    if (ok && typeof data.url === "string") {
      window.location.assign(data.url);
      return;
    }
    setMessage("We couldn't open the tip payment. Please try again.");
    await load();
    setBusy(false);
  }

  if (unavailable || review === undefined) return null;

  // ---- Already reviewed: show how the tip is going ----
  if (review) {
    const tip = formatCents(review.tip_cents);
    return (
      <div className="card rate-card" aria-live="polite">
        <span className="badge badge-success">Review sent</span>
        <h2 className="pay-title">Thanks for rating {name}</h2>
        <p className="rate-stars-done" aria-label={`${review.rating} out of 5 stars`}>
          {"★".repeat(review.rating)}
          <span className="rate-stars-off">{"★".repeat(5 - review.rating)}</span>
        </p>
        {checkout === "tip_success" && review.tip_status === "pending" && (
          <div className="notice notice-success">
            Thanks! We&rsquo;re confirming your tip payment with Stripe. This usually takes a few seconds.
          </div>
        )}
        {checkout === "tip_cancelled" && review.tip_status === "pending" && (
          <div className="notice notice-error">Your tip payment wasn&rsquo;t completed.</div>
        )}
        {message && <div className="notice notice-error">{message}</div>}
        {review.tip_status === "none" && <p className="muted">Your feedback helps keep NemaGo mechanics great.</p>}
        {review.tip_status === "pending" && (
          <>
            <p className="muted">
              You chose a <strong>{tip}</strong> tip, but it hasn&rsquo;t been paid yet. {TIP_NOTE}
            </p>
            <button type="button" className="btn btn-primary" onClick={payTip} disabled={busy}>
              {busy ? "Taking you to payment…" : `Pay ${tip} tip`}
            </button>
          </>
        )}
        {review.tip_status === "paid" && (
          <p className="muted">
            Your <strong>{tip}</strong> tip was received and is on its way to {name}. {TIP_NOTE}
          </p>
        )}
        {review.tip_status === "sent" && (
          <p className="muted">
            Your <strong>{tip}</strong> tip went to {name}. {TIP_NOTE}
          </p>
        )}
      </div>
    );
  }

  // ---- Not reviewed yet: the form ----
  const label = tipCents > 0 ? `Submit review & pay ${formatCents(tipCents)} tip` : "Submit review";
  return (
    <form className="card rate-card" onSubmit={submit} aria-labelledby="rate-title">
      <span className="badge badge-success">Job completed</span>
      <h2 id="rate-title" className="pay-title">
        Rate &amp; Tip Your Mechanic
      </h2>
      <p className="muted">How did {name} do?</p>

      {message && <div className="notice notice-error">{message}</div>}

      <div className="stars" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            className={"star" + (n <= rating ? " star-on" : "")}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>

      <p className="rate-label">What went well? (optional)</p>
      <div className="chip-group" role="group" aria-label="Quick feedback">
        {REVIEW_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"chip" + (tags.includes(t.id) ? " chip-on" : "")}
            aria-pressed={tags.includes(t.id)}
            onClick={() => setTags((cur) => (cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="field rate-comment">
        Add a comment (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          placeholder={`Anything else you'd like to say about ${name}?`}
        />
      </label>

      <p className="rate-label">Add a tip</p>
      <div className="chip-group" role="radiogroup" aria-label="Tip amount">
        {TIP_PRESETS_CENTS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={preset === c}
            className={"chip" + (preset === c ? " chip-on" : "")}
            onClick={() => setPreset(c)}
          >
            {formatCents(c).replace(".00", "")}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={preset === "custom"}
          className={"chip" + (preset === "custom" ? " chip-on" : "")}
          onClick={() => setPreset("custom")}
        >
          Custom
        </button>
      </div>
      {preset === "custom" && (
        <label className="field rate-custom">
          Tip amount in dollars ($1 to $200)
          <input
            type="text"
            inputMode="decimal"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="7.50"
            autoComplete="off"
            aria-invalid={customBad}
          />
        </label>
      )}
      {customBad && <p className="notice notice-error">Please enter a tip between $1 and $200.</p>}
      <p className="rate-note">
        <strong>{TIP_NOTE}</strong>
      </p>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || rating === 0 || customBad || customMissing}
      >
        {busy ? "Sending…" : label}
      </button>
      {rating === 0 && <p className="muted small">Choose a star rating to continue.</p>}
    </form>
  );
}
