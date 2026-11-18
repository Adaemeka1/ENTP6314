import Link from "next/link";

// "How can we help today?": the two ways to book.
export function BookingChooser() {
  return (
    <section className="chooser" aria-labelledby="chooser-title">
      <h2 id="chooser-title" className="chooser-title">
        How can we help today?
      </h2>
      <Link href="/driver/book/service" className="card card-link choice-card">
        <strong>I Know What I Need</strong>
        <p className="muted">
          Routine maintenance &amp; everyday fixes with upfront flat pricing. Parts &amp; labor included. No
          diagnosis fee.
        </p>
      </Link>
      <Link href="/driver/book/diagnosis" className="card card-link choice-card">
        <strong>Something Is Wrong</strong>
        <p className="muted">
          Check engine light, strange noises, or car won&rsquo;t start. Book an on-site diagnosis.
        </p>
      </Link>
      <p className="muted small chooser-hint">
        Not sure which to pick? <Link href="/driver/triage">Describe the problem first</Link> and get a quick
        triage.
      </p>
    </section>
  );
}
