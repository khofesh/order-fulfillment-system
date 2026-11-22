import { notify } from "../shared/notify";
import { getOrder, updateOrderStatus } from "../shared/repository";
import type { FulfillmentResult, OrderStatus } from "../shared/types";

export interface UpdateOrderEvent {
  orderId: string;
  status: Extract<OrderStatus, "DELIVERED" | "FAILED" | "PENDING_RETRY">;
  fulfillment?: FulfillmentResult;
  error?: { Error?: string; Cause?: string };
}

/** Fpersist outcome and notify customer/ops. */
export const handler = async (event: UpdateOrderEvent): Promise<void> => {
  const lastError = event.error ? describeError(event.error) : undefined;
  const updated = await updateOrderStatus(
    event.orderId,
    event.status,
    {
      code: event.fulfillment?.code,
      redemptionUrl: event.fulfillment?.redemptionUrl,
      lastError,
    },
    ["taskToken"],
  );
  if (!updated) return; // already DELIVERED: nothing changed, nothing to announce

  const order = await getOrder(event.orderId);
  await notify(
    `Order ${event.orderId} ${event.status}`,
    { order: order && { ...order, taskToken: undefined }, error: event.error },
    { kind: "order", status: event.status },
  );
};

/** Step Functions error -> short reason  */
function describeError(error: { Error?: string; Cause?: string }): string {
  let message = error.Cause;
  try {
    message =
      (JSON.parse(error.Cause ?? "") as { errorMessage?: string })
        .errorMessage ?? message;
  } catch {
    // plain-text cause
  }
  return [error.Error, message].filter(Boolean).join(": ").slice(0, 500);
}
