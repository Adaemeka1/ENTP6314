"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RepairQuote = {
  request_id: string;
  issue_summary: string;
  repair_description: string;
  photo_id: string;
  parts_cents: number;
  labor_cents: number;
  credit_cents: number;
  net_due_cents: number;
  mechanic_payout_cents: number;
  nemago_labor_cut_cents: number;
  repair_date: string;
  window_start: string;
  window_end: string;
  status: "sent" | "paid" | "completed" | "declined" | "withdrawn";
  payout_status: "none" | "pending" | "paid_out" | "failed";
};

const COLUMNS =
  "request_id, issue_summary, repair_description, photo_id, parts_cents, labor_cents, credit_cents, net_due_cents, mechanic_payout_cents, nemago_labor_cut_cents, repair_date, window_start, window_end, status, payout_status";

// Looks up the repair quote for a job and keeps it fresh. This reads its own table,
// so if repair.sql hasn't been run yet the quote is simply "none" and the rest of
// the screen is unaffected. Pass null to switch it off.
export function useRepairQuote(requestId: string | null, poll = true) {
  const [quote, setQuote] = useState<RepairQuote | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const reload = useCallback(async () => {
    if (!requestId) return;
    const { data, error } = await createClient()
      .from("repair_quotes")
      .select(COLUMNS)
      .eq("request_id", requestId)
      .maybeSingle();
    setUnavailable(!!error);
    setQuote(error ? null : ((data as RepairQuote | null) ?? null));
    setLoadedFor(requestId);
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    reload();
    if (!poll) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [requestId, reload, poll]);

  // Only report a quote that belongs to the request being asked about.
  const mine = requestId && loadedFor === requestId && quote?.request_id === requestId ? quote : null;
  // loaded: we have an answer. unavailable: the table isn't there (repair.sql not run yet).
  return { quote: mine, reload, loaded: !!requestId && loadedFor === requestId, unavailable };
}
