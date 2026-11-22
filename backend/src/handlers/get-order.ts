import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { json } from "../shared/http";
import {
  getOrder,
  listOrdersByCustomer,
  listOrdersByStatus,
} from "../shared/repository";
import type { OrderStatus } from "../shared/types";

/** GET /orders/{orderId}, GET /customers/{customerId}/orders, GET /ops/orders?status= */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const { orderId, customerId } = event.pathParameters ?? {};

  if (orderId) {
    const order = await getOrder(orderId);
    return order ? json(200, order) : json(404, { message: "Order not found" });
  }
  if (customerId) {
    return json(200, { items: await listOrdersByCustomer(customerId) });
  }
  const status = (event.queryStringParameters?.status ??
    "FAILED") as OrderStatus;
  return json(200, { items: await listOrdersByStatus(status) });
};
