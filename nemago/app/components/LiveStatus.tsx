// Small line that tells people whether updates are instant or every few seconds.
export function LiveStatus({ live }: { live: boolean }) {
  return (
    <p className="live-status" role="status">
      <span className={live ? "live-dot live-dot-on" : "live-dot"} />
      {live ? "Live: updates appear instantly" : "Checking for updates every few seconds"}
    </p>
  );
}
