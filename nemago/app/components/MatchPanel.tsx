"use client";

import { useEffect, useState } from "react";
import { MatchBreakdown } from "@/components/MatchBreakdown";
import { postJson } from "@/lib/dispatch";
import type { PublicMatch } from "@/lib/match";

type MatchResponse = {
  mode: "ranking" | "matched";
  considered: number;
  rank?: number | null;
  matches: Array<PublicMatch & { label: string }>;
};

// The driver's "Smart Dispatch Match" panel. While a request is waiting it shows
// how the best mechanics rank; once a mechanic accepts it shows why they were
// matched. If the server can't provide it (for example the matching database file
// hasn't been run yet) it shows nothing, and the rest of the screen is unaffected.
export function MatchPanel({
  requestId,
  status,
  etaMinutes,
}: {
  requestId: string;
  status: string;
  etaMinutes: number | null;
}) {
  const [data, setData] = useState<MatchResponse | null>(null);

  useEffect(() => {
    let stopped = false;
    postJson("/api/match", { requestId }).then(({ ok, data: body }) => {
      if (stopped) return;
      setData(ok ? (body as unknown as MatchResponse) : null);
    });
    return () => {
      stopped = true;
    };
    // Look again whenever the request changes (a mechanic accepts, gives an ETA...).
  }, [requestId, status, etaMinutes]);

  if (!data || data.matches.length === 0) return null;

  if (data.mode === "matched") {
    const m = data.matches[0];
    return (
      <MatchBreakdown
        match={m}
        title="Match Score Breakdown"
        intro={
          m.label +
          " was matched to you" +
          (data.rank ? ` (ranked #${data.rank} of ${data.considered} eligible mechanics)` : "") +
          ". Here is why."
        }
      />
    );
  }

  return (
    <div className="match-panel">
      <p className="match-title">Smart Dispatch Match</p>
      <p className="match-intro">
        Ranking {data.considered} verified {data.considered === 1 ? "mechanic" : "mechanics"} for your
        problem. The first qualified mechanic to accept gets your job.
      </p>
      {data.matches.map((m, i) => (
        <MatchBreakdown key={m.label} match={m} title={m.label} open={i === 0} />
      ))}
    </div>
  );
}
