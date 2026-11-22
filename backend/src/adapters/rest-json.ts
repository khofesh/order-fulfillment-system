import { resolveSupplierSecret } from "../shared/secrets";
import type {
  FulfillmentStatus,
  Order,
  SupplierMapping,
} from "../shared/types";
import {
  SupplierPermanentError,
  SupplierRetryableError,
  type AdapterFactory,
} from "./types";

const DEFAULT_MAPPING: Required<SupplierMapping> = {
  fulfillPath: "/orders",
  statusPath: "/orders/{id}",
  healthPath: "/health",
  idField: "id",
  statusField: "status",
  codeField: "code",
  redemptionUrlField: "redemptionUrl",
};

const TIMEOUT_MS = 10_000;

/** reads a dotted path (`data.voucher.pin`) from a JSON object */
export function pick(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (cur, key) =>
        cur && typeof cur === "object"
          ? (cur as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

export const restJsonAdapter: AdapterFactory = (config) => {
  const m = { ...DEFAULT_MAPPING, ...config.mapping };

  const toStatus = (value: unknown): FulfillmentStatus => {
    const raw = String(value ?? "");
    const mapped = config.statusMap?.[raw] ?? raw;
    // Unknown values are treated as still in progress; the poll cap bounds them.
    return mapped === "DELIVERED" || mapped === "FAILED" ? mapped : "PENDING";
  };

  async function call(path: string, init: RequestInit) {
    const apiKey = await resolveSupplierSecret(config, "apiKey");
    let res: Response;
    try {
      res = await fetch(`${config.endpoint}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...init.headers,
        },
      });
    } catch (err) {
      throw new SupplierRetryableError(
        `Network error: ${(err as Error).message}`,
      );
    }
    if (res.status >= 500 || res.status === 429 || res.status === 408) {
      throw new SupplierRetryableError(
        `Supplier ${config.supplierId} returned ${res.status}`,
      );
    }
    if (!res.ok) {
      throw new SupplierPermanentError(
        `Supplier ${config.supplierId} returned ${res.status}`,
      );
    }
    return res.json().catch(() => {
      throw new SupplierRetryableError(
        `Supplier ${config.supplierId} returned invalid JSON`,
      );
    }) as Promise<Record<string, unknown>>;
  }

  const fields = (body: Record<string, unknown>) => ({
    status: toStatus(pick(body, m.statusField)),
    code: pick(body, m.codeField) as string | undefined,
    redemptionUrl: pick(body, m.redemptionUrlField) as string | undefined,
  });

  return {
    async fulfill(order: Order) {
      const body = await call(m.fulfillPath, {
        method: "POST",
        headers: { "Idempotency-Key": order.idempotencyKey },
        body: JSON.stringify({
          reference: order.idempotencyKey,
          productId: order.productId,
          amount: order.amount,
          currency: order.currency,
          gameId: order.gameId,
          playerId: order.playerId,
        }),
      });
      const id = pick(body, m.idField);
      if (id === undefined || id === null || id === "") {
        throw new SupplierPermanentError(
          `Supplier ${config.supplierId} response has no ${m.idField}`,
        );
      }
      return { supplierOrderId: String(id), ...fields(body), raw: body };
    },
    async checkStatus(supplierOrderId: string) {
      const body = await call(
        m.statusPath.replace("{id}", encodeURIComponent(supplierOrderId)),
        { method: "GET" },
      );
      return { supplierOrderId, ...fields(body) };
    },
    async healthCheck() {
      try {
        await call(m.healthPath, { method: "GET" });
        return true;
      } catch {
        return false;
      }
    },
  };
};
