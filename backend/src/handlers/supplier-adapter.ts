import { SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import { createAdapter } from "../adapters/registry";
import {
  SupplierPermanentError,
  SupplierRetryableError,
  SupplierUnavailableError,
} from "../adapters/types";
import { sfn } from "../shared/clients";
import { circuitBreakerThreshold } from "../shared/env";
import { callbackRecordId } from "../shared/keys";
import { notify } from "../shared/notify";
import {
  getFulfillmentRecord,
  getOrder,
  getSupplier,
  putFulfillmentRecord,
  recordSupplierFailure,
  recordSupplierSuccess,
  saveTaskToken,
  updateOrderStatus,
} from "../shared/repository";
import type { FulfillmentResult } from "../shared/types";

export type AdapterAction = "FULFILL" | "CHECK_STATUS" | "AWAIT_CALLBACK";

export interface AdapterEvent {
  action: AdapterAction;
  orderId: string;
  supplierOrderId?: string;
  taskToken?: string;
}

export const handler = async (
  event: AdapterEvent,
): Promise<Partial<FulfillmentResult>> => {
  if (event.action === "AWAIT_CALLBACK") return awaitCallback(event);

  const order = await getOrder(event.orderId);
  if (!order)
    throw new SupplierPermanentError(`Order ${event.orderId} not found`);

  const supplier = await getSupplier(order.supplierId);
  if (!supplier)
    throw new SupplierPermanentError(`Supplier ${order.supplierId} not found`);
  if (!supplier.active)
    throw new SupplierUnavailableError(
      `Supplier ${supplier.supplierId} circuit is open`,
    );

  const adapter = createAdapter(supplier);
  try {
    let result: FulfillmentResult;
    if (event.action === "CHECK_STATUS") {
      if (!event.supplierOrderId)
        throw new SupplierPermanentError("supplierOrderId is required");
      result = {
        ...(await adapter.checkStatus(event.supplierOrderId)),
        supplierOrderId: event.supplierOrderId,
      };
    } else {
      await updateOrderStatus(order.orderId, "PROCESSING");
      result = await adapter.fulfill(order);
      await putFulfillmentRecord(order.orderId, { ...result, raw: undefined });
    }
    await recordSupplierSuccess(supplier.supplierId);
    return { ...result, raw: undefined };
  } catch (err) {
    if (err instanceof SupplierRetryableError) {
      const opened = await recordSupplierFailure(
        supplier.supplierId,
        circuitBreakerThreshold(),
      );
      if (opened) {
        console.warn("circuit opened", { supplierId: supplier.supplierId });
        await notify(
          `Supplier ${supplier.supplierId} circuit opened`,
          {
            supplierId: supplier.supplierId,
            reason: err.message,
          },
          { status: "CIRCUIT_OPEN" },
        );
      }
    }
    throw err;
  }
};

async function awaitCallback(
  event: AdapterEvent,
): Promise<Partial<FulfillmentResult>> {
  if (!event.taskToken || !event.supplierOrderId) {
    throw new SupplierPermanentError(
      "taskToken and supplierOrderId are required",
    );
  }
  await saveTaskToken(event.orderId, event.taskToken);

  const early = await getFulfillmentRecord(
    event.orderId,
    callbackRecordId(event.supplierOrderId),
  );
  if (early && early.status !== "PENDING") {
    await sfn.send(
      new SendTaskSuccessCommand({
        taskToken: event.taskToken,
        output: JSON.stringify({
          status: early.status,
          supplierOrderId: event.supplierOrderId,
          code: early.code,
          redemptionUrl: early.redemptionUrl,
        }),
      }),
    );
  }
  return {};
}
