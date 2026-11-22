export type OrderType = "GIFT_CARD" | "TOPUP";

export type OrderStatus = "PENDING" | "PROCESSING" | "PENDING_RETRY" | "DELIVERED" | "FAILED";

export const SETTLED_STATUSES: readonly OrderStatus[] = ["DELIVERED", "FAILED", "PENDING_RETRY"];

export const RETRYABLE_STATUSES: readonly OrderStatus[] = ["FAILED", "PENDING_RETRY"];

export interface Order {
  orderId: string;
  type: OrderType;
  status: OrderStatus;
  supplierId: string;
  productId: string;
  amount: number;
  currency: string;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  retries?: number;
  lastError?: string;
  code?: string;
  redemptionUrl?: string;
  gameId?: string;
  playerId?: string;
}

export interface CreateOrderRequest {
  type: OrderType;
  supplierId: string;
  productId: string;
  amount: number;
  currency: string;
  customerId: string;
  gameId?: string;
  playerId?: string;
}

export interface SupplierStatus {
  supplierId: string;
  adapterType: string;
  /** false = circuit breaker open */
  active: boolean;
  consecutiveFailures: number;
  circuitOpenedAt?: string;
}
