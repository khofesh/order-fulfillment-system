import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { startFulfillment } from "../shared/fulfillment";
import { header, json } from "../shared/http";
import { deriveOrderId, isValidIdempotencyKey } from "../shared/idempotency";
import {
  getOrder,
  getSupplier,
  isConditionalCheckFailed,
  putOrder,
} from "../shared/repository";
import type { Order } from "../shared/types";
import { validateCreateOrder } from "../shared/validation";

/**
 * POST /orders. Send an `Idempotency-Key` header to make retries safe
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let body: unknown;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { message: "Invalid JSON body" });
  }

  const parsed = validateCreateOrder(body);
  if (!parsed.ok)
    return json(400, { message: "Invalid order", errors: parsed.errors });
  const req = parsed.value;

  const clientKey = header(event, "Idempotency-Key");
  if (clientKey !== undefined && !isValidIdempotencyKey(clientKey)) {
    return json(400, {
      message: "Idempotency-Key must be 8-128 characters of [A-Za-z0-9_-]",
    });
  }

  const supplier = await getSupplier(req.supplierId);
  if (!supplier)
    return json(404, { message: `Unknown supplier ${req.supplierId}` });

  const orderId = deriveOrderId(req.customerId, clientKey);
  const now = new Date().toISOString();
  const order: Order = {
    orderId,
    status: "PENDING",
    ...req,
    idempotencyKey: `ord-${orderId}`,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putOrder(order);
  } catch (err) {
    if (!isConditionalCheckFailed(err)) throw err;
    const existing = (await getOrder(orderId))!;
    if (existing.status === "PENDING") await startFulfillment(existing);
    return json(200, existing);
  }

  await startFulfillment(order);
  return json(202, order);
};
