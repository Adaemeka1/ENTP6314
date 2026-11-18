import { partsOrderOf, type DispatchRequest } from "@/lib/dispatch";

// "Parts Ready for Pickup": shown to the mechanic once the driver has paid. NemaGo
// buys the parts at a commercial store ahead of time, so the mechanic pays $0.
// Store and order number are entered by NemaGo staff (there is no store integration yet),
// so until then the card honestly says the order is being prepared.
export function PartsPickupCard({ request }: { request: DispatchRequest }) {
  const order = partsOrderOf(request);
  if (!order || order.status === "cancelled") return null;
  const ready = order.status === "ready" || order.status === "picked_up";

  return (
    <div className="parts-card">
      <div className="parts-head">
        <strong>{ready ? "Parts Ready for Pickup" : "Parts order being prepared"}</strong>
        <span className={ready ? "badge badge-success" : "badge"}>
          {order.status === "picked_up" ? "Picked up" : ready ? "Ready" : "Preparing"}
        </span>
      </div>
      {ready ? (
        <p className="small">
          <strong>Store:</strong> {order.store_name ?? "Store details coming"}
          {order.store_address && (
            <>
              <br />
              <strong>Address:</strong> {order.store_address}
            </>
          )}
          {order.order_number && (
            <>
              <br />
              <strong>Order number:</strong> {order.order_number}
            </>
          )}
        </p>
      ) : (
        <p className="small muted">
          NemaGo is ordering your parts. The store and order number appear here as soon as they are ready.
        </p>
      )}
      <p className="small">Pre-paid by NemaGo. You pay $0 at the counter and never wait for a reimbursement.</p>
    </div>
  );
}
