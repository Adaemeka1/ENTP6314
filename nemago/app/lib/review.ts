// Rating & Tip rules, shared by the driver's screen and the server (no imports).
// The server and the database check everything again: the browser is never trusted.

export const REVIEW_TAGS = [
  { id: "on_time", label: "On Time" },
  { id: "photo_proof", label: "Clear Photo Proof" },
  { id: "clean_work", label: "Clean Work" },
  { id: "great_communication", label: "Great Communication" },
] as const;

export type ReviewTagId = (typeof REVIEW_TAGS)[number]["id"];

// Quick tip choices, in cents. $0 means no tip. "Custom" lets the driver type an amount.
export const TIP_PRESETS_CENTS = [0, 500, 1000, 1500] as const;
export const MIN_TIP_CENTS = 100; // $1
export const MAX_TIP_CENTS = 20000; // $200
export const MAX_COMMENT_LENGTH = 500;

export const TIP_NOTE = "100% of your tip goes directly to your mechanic.";

export type ReviewInput = {
  rating: number;
  tags: ReviewTagId[];
  comment: string | null;
  tipCents: number;
};

export function isValidTip(cents: number) {
  return Number.isInteger(cents) && (cents === 0 || (cents >= MIN_TIP_CENTS && cents <= MAX_TIP_CENTS));
}

// "7.50" -> 750. Anything that isn't a plain dollar amount -> null.
export function dollarsToCents(text: string): number | null {
  const clean = text.trim().replace(/^\$/, "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function validateReview(
  body: Record<string, unknown>,
): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  const rating = body.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Please choose 1 to 5 stars." };
  }

  const rawTags = body.tags === undefined ? [] : body.tags;
  if (!Array.isArray(rawTags)) return { ok: false, error: "Those quick tags aren't valid." };
  const allowed: string[] = REVIEW_TAGS.map((t) => t.id);
  if (!rawTags.every((t) => typeof t === "string" && allowed.includes(t))) {
    return { ok: false, error: "Those quick tags aren't valid." };
  }
  const tags = Array.from(new Set(rawTags as ReviewTagId[]));

  let comment: string | null = null;
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== "string") return { ok: false, error: "That comment isn't valid." };
    const trimmed = body.comment.trim();
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      return { ok: false, error: `Please keep your comment under ${MAX_COMMENT_LENGTH} characters.` };
    }
    comment = trimmed === "" ? null : trimmed;
  }

  const tip = body.tipCents === undefined ? 0 : body.tipCents;
  if (typeof tip !== "number" || !isValidTip(tip)) {
    return { ok: false, error: "A tip can be $0, or between $1 and $200." };
  }

  return { ok: true, value: { rating, tags, comment, tipCents: tip } };
}
