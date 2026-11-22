import { SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { sfn } from "../shared/clients";
import { header, json, rawBody } from "../shared/http";
import { callbackRecordId } from "../shared/keys";
import {
  getOrder,
  getSupplier,
  putFulfillmentRecord,
} from "../shared/repository";
import { resolveSupplierSecret } from "../shared/secrets";
import { SIGNATURE_HEADER, verifySignature } from "../shared/signature";
import type { FulfillmentStatus } from "../shared/types";

interface CallbackBody {
  orderId?: string;
  supplierOrderId?: string;
  status?: FulfillmentStatus;
  code?: string;
  redemptionUrl?: string;
}

const STATUSES: FulfillmentStatus[] = ["DELIVERED", "PENDING", "FAILED"];

/**
 * POST /callbacks/{supplierId} — async result pushed by a supplier.
 *
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const supplierId = event.pathParameters?.supplierId ?? "";
  const supplier = await getSupplier(supplierId);
  if (!supplier)
    return json(404, { message: `Unknown supplier ${supplierId}` });

  const raw = rawBody(event);
  const secret = await resolveSupplierSecret(supplier, "callbackSecret");
  if (
    secret
      ? !verifySignature(secret, raw, header(event, SIGNATURE_HEADER))
      : supplier.adapterType !== "MOCK"
  ) {
    return json(401, { message: "Invalid or missing signature" });
  }

  let body: CallbackBody;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json(400, { message: "Invalid JSON body" });
  }
  if (
    !body.orderId ||
    !body.supplierOrderId ||
    !STATUSES.includes(body.status as FulfillmentStatus)
  ) {
    return json(400, {
      message:
        "orderId, supplierOrderId and status (DELIVERED|PENDING|FAILED) are required",
    });
  }

  const order = await getOrder(body.orderId);
  if (!order || order.supplierId !== supplierId)
    return json(404, { message: "Order not found" });

  const isNew = await putFulfillmentRecord(body.orderId, {
    status: body.status!,
    supplierOrderId: callbackRecordId(body.supplierOrderId),
    code: body.code,
    redemptionUrl: body.redemptionUrl,
  });
  if (!isNew) return json(200, { message: "Duplicate callback ignored" });

  if (body.status !== "PENDING" && order.taskToken) {
    try {
      await sfn.send(
        new SendTaskSuccessCommand({
          taskToken: order.taskToken,
          output: JSON.stringify({
            status: body.status,
            supplierOrderId: body.supplierOrderId,
            code: body.code,
            redemptionUrl: body.redemptionUrl,
          }),
        }),
      );
    } catch (err) {
      if (
        !["TaskTimedOut", "TaskDoesNotExist", "InvalidToken"].includes(
          (err as Error).name,
        )
      )
        throw err;
      console.log("callback stored, execution not waiting", {
        orderId: body.orderId,
      });
    }
  }

  return json(202, { message: "Accepted" });
};
