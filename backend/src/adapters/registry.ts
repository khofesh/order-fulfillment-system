import type { AdapterType, SupplierConfig } from "../shared/types";
import { mockAdapter } from "./mock";
import { restJsonAdapter } from "./rest-json";
import type { AdapterFactory, SupplierAdapter } from "./types";

const factories: Record<AdapterType, AdapterFactory> = {
  MOCK: mockAdapter,
  REST_JSON: restJsonAdapter,
};

export function createAdapter(config: SupplierConfig): SupplierAdapter {
  const factory = factories[config.adapterType];
  if (!factory)
    throw new Error(`No adapter registered for type ${config.adapterType}`);
  return factory(config);
}
