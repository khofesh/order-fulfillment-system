import type { FulfillmentStatus } from "../shared/types";
import type { AdapterFactory } from "./types";

/**
 * In-memory supplier for local development and tests.
 *
 * - `slow-*`   PENDING first, DELIVERED on the first status check (polling path)
 * - `async-*`  PENDING until a callback arrives (callback path / poll cap)
 * - `reject-*` FAILED (supplier rejects the order)
 * - anything else: DELIVERED immediately
 */
type Mode = "instant" | "slow" | "async" | "reject";

const modeOf = (productId: string): Mode => {
  const prefix = productId.split("-")[0];
  return prefix === "slow" || prefix === "async" || prefix === "reject"
    ? prefix
    : "instant";
};

const initialStatus: Record<Mode, FulfillmentStatus> = {
  instant: "DELIVERED",
  slow: "PENDING",
  async: "PENDING",
  reject: "FAILED",
};

export const mockAdapter: AdapterFactory = () => ({
  async fulfill(order) {
    const mode = modeOf(order.productId);
    // deterministic per idempotency key
    const supplierOrderId = `mock-${mode}-${order.idempotencyKey}`;
    const status = initialStatus[mode];
    if (status === "DELIVERED" && order.type === "GIFT_CARD") {
      return {
        status,
        supplierOrderId,
        code: `MOCK-${order.orderId.slice(0, 8).toUpperCase()}`,
        redemptionUrl: "https://example.com/redeem",
      };
    }
    return { status, supplierOrderId };
  },
  async checkStatus(supplierOrderId) {
    const mode = supplierOrderId.split("-")[1] as Mode;
    if (mode === "async") return { status: "PENDING", supplierOrderId };
    if (mode === "reject") return { status: "FAILED", supplierOrderId };
    return {
      status: "DELIVERED",
      supplierOrderId,
      code: `MOCK-${supplierOrderId.slice(-8).toUpperCase()}`,
      redemptionUrl: "https://example.com/redeem",
    };
  },
  async healthCheck() {
    return true;
  },
});
