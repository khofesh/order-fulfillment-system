import type {
  FulfillmentResult,
  FulfillmentStatus,
  Order,
  SupplierConfig,
} from "../shared/types";

export interface SupplierAdapter {
  fulfill(order: Order): Promise<FulfillmentResult>;
  checkStatus(
    supplierOrderId: string,
  ): Promise<{ status: FulfillmentStatus } & Partial<FulfillmentResult>>;
  healthCheck?(): Promise<boolean>;
}

export type AdapterFactory = (config: SupplierConfig) => SupplierAdapter;

export class SupplierRetryableError extends Error {
  override name = "SupplierRetryableError";
}

export class SupplierPermanentError extends Error {
  override name = "SupplierPermanentError";
}

export class SupplierUnavailableError extends Error {
  override name = "SupplierUnavailableError";
}
