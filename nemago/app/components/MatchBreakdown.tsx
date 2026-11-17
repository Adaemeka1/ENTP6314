import { DEMO_NOTE, ISSUE_LABELS, type PublicMatch } from "@/lib/match";

// "96% Match • 11 mins away • ASE Certified • Parts Ready"
export function MatchBadges({ match }: { match: PublicMatch }) {
  return (
    <div className="match-tags" aria-label="Match summary">
      <span className="match-score">{match.score}% Match</span>
      {match.tags.map((tag) => (
        <span key={tag.text} className={"match-tag match-tag-" + tag.tone}>
          {tag.text}
        </span>
      ))}
    </div>
  );
}

// The five weighted factors behind the score, each as a labelled bar.
export function MatchFactors({ match }: { match: PublicMatch }) {
  return (
    <div className="match-factors">
      {match.factors.map((f) => (
        <div key={f.key} className="factor">
          <div className="factor-head">
            <span>{f.label}</span>
            <strong>
              {f.points.toFixed(1)} / {f.weight}
            </strong>
          </div>
          <div className="factor-track" aria-hidden="true">
            <div className="factor-fill" style={{ width: Math.round(f.score * 100) + "%" }} />
          </div>
          <p className="factor-detail">{f.detail}</p>
        </div>
      ))}
      <p className="match-demo-note">{DEMO_NOTE}</p>
    </div>
  );
}

// The "Match Score Breakdown": the badge row, with the working shown underneath.
export function MatchBreakdown({
  match,
  title = "Match Score Breakdown",
  intro,
  open = false,
}: {
  match: PublicMatch;
  title?: string;
  intro?: string;
  open?: boolean;
}) {
  return (
    <div className="match-card">
      <p className="match-title">{title}</p>
      {intro && <p className="match-intro">{intro}</p>}
      <MatchBadges match={match} />
      <details className="match-details" open={open}>
        <summary>
          How this score was calculated (for a {ISSUE_LABELS[match.issue]} problem)
        </summary>
        <MatchFactors match={match} />
      </details>
    </div>
  );
}
