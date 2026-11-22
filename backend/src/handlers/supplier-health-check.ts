import { createAdapter } from "../adapters/registry";
import { maxAutoRetries } from "../shared/env";
import { restartFulfillment } from "../shared/fulfillment";
import {
  enableSupplier,
  listAllOrdersByStatus,
  listSuppliers,
} from "../shared/repository";

/**
 * Scheduled by EventBridge.
 */
export const handler = async (): Promise<{
  reenabled: string[];
  restarted: string[];
}> => {
  const suppliers = await listSuppliers();
  const reenabled: string[] = [];

  for (const supplier of suppliers.filter((s) => !s.active)) {
    const healthy =
      (await createAdapter(supplier)
        .healthCheck?.()
        .catch(() => false)) ?? false;
    if (healthy) {
      await enableSupplier(supplier.supplierId);
      supplier.active = true;
      reenabled.push(supplier.supplierId);
      console.log("supplier re-enabled", supplier.supplierId);
    }
  }

  const active = new Set(
    suppliers.filter((s) => s.active).map((s) => s.supplierId),
  );
  const restarted: string[] = [];
  for (const order of await listAllOrdersByStatus("PENDING_RETRY")) {
    if (
      !active.has(order.supplierId) ||
      (order.retries ?? 0) >= maxAutoRetries()
    )
      continue;
    if (await restartFulfillment(order.orderId)) restarted.push(order.orderId);
  }
  if (restarted.length) console.log("restarted parked orders", restarted);

  return { reenabled, restarted };
};
