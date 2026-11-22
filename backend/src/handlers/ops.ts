import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { restartFulfillment } from "../shared/fulfillment";
import { json } from "../shared/http";
import { getOrder, listSuppliers } from "../shared/repository";

/**
 * Ops API:
 * - GET  /ops/suppliers                 circuit breaker status per supplier
 * - POST /ops/orders/{orderId}/retry    replay a FAILED / PENDING_RETRY order
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const orderId = event.pathParameters?.orderId;

  if (event.httpMethod === "POST" && orderId) {
    const restarted = await restartFulfillment(orderId);
    if (restarted) return json(202, restarted);
    const order = await getOrder(orderId);
    return order
      ? json(409, {
          message: `Order is ${order.status}; only FAILED or PENDING_RETRY orders can be retried`,
        })
      : json(404, { message: "Order not found" });
  }

  const suppliers = await listSuppliers();
  return json(200, {
    items: suppliers
      .map((s) => ({
        supplierId: s.supplierId,
        adapterType: s.adapterType,
        active: s.active,
        consecutiveFailures: s.consecutiveFailures ?? 0,
        circuitOpenedAt: s.circuitOpenedAt,
      }))
      .sort((a, b) => a.supplierId.localeCompare(b.supplierId)),
  });
};
