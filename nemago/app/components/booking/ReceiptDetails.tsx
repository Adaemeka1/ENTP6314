import { CheckoutSummary, linesFromTransaction } from "@/components/booking/CheckoutSummary";
import { transactionOf, type DispatchRequest } from "@/lib/dispatch";
import { findService, shortServiceName } from "@/lib/services";

// "Full Synthetic Oil & Filter Change", "Front Brake Pad Replacement", or "Diagnosis visit".
export function bookingTitle(request: Pick<DispatchRequest, "booking_type" | "service_id">) {
  if (request.booking_type === "fixed_price") {
    const service = findService(request.service_id);
    return service ? shortServiceName(service) : "Fixed-price service";
  }
  return "Diagnosis visit";
}

// A collapsible itemized breakdown of what a job costs, from what the database stored.
export function ReceiptDetails({ request, title = "See what you paid for" }: { request: DispatchRequest; title?: string }) {
  const tx = transactionOf(request);
  if (!tx || request.price_cents === null) return null;
  return (
    <details className="match-details">
      <summary>{title}</summary>
      <CheckoutSummary
        lines={linesFromTransaction(tx, request.booking_type)}
        totalCents={request.price_cents}
        title="Payment breakdown"
        badge={null}
      />
    </details>
  );
}
