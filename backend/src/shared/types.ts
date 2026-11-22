export type OrderType = "GIFT_CARD" | "TOPUP";

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "PENDING_RETRY"
  | "DELIVERED"
  | "FAILED";

export const RETRYABLE_STATUSES: readonly OrderStatus[] = [
  "PENDING_RETRY",
  "FAILED",
];

export interface Order {
  orderId: string;
  type: OrderType;
  status: OrderStatus;
  supplierId: string;
  productId: string;
  amount: number;
  currency: string;
  customerId: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  /** Number of times fulfillment was restarted after FAILED / PENDING_RETRY. */
  retries?: number;
  lastError?: string;
  /** Step Functions task token while the execution waits for a supplier callback. */
  taskToken?: string;
  // Sparse attributes: gift card orders
  code?: string;
  redemptionUrl?: string;
  // Sparse attributes: top-up orders
  gameId?: string;
  playerId?: string;
}

export type AdapterType = "MOCK" | "REST_JSON";

export type FulfillmentStatus = "DELIVERED" | "PENDING" | "FAILED";

export interface SupplierMapping {
  fulfillPath?: string;
  statusPath?: string;
  healthPath?: string;
  idField?: string;
  statusField?: string;
  codeField?: string;
  redemptionUrlField?: string;
}

export interface SupplierConfig {
  supplierId: string;
  adapterType: AdapterType;
  endpoint: string;
  authConfig?: Record<string, string>;
  mapping?: SupplierMapping;
  /** Supplier status value -> internal status, e.g. { "SUCCESS": "DELIVERED" }. */
  statusMap?: Record<string, FulfillmentStatus>;
  active: boolean;
  rateLimitPerSecond?: number;
  // Circuit breaker state, maintained at runtime.
  consecutiveFailures?: number;
  circuitOpenedAt?: string;
}

export interface FulfillmentResult {
  status: FulfillmentStatus;
  supplierOrderId: string;
  code?: string;
  redemptionUrl?: string;
  raw?: unknown;
}
