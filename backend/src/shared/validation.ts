import type { OrderType } from "./types";

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

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const ID = /^[A-Za-z0-9._:@-]{1,128}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MAX_AMOUNT = 10_000;

/** Validates POST /orders */
export function validateCreateOrder(
  input: unknown,
): Validated<CreateOrderRequest> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const body = input as Record<string, unknown>;
  const errors: string[] = [];
  const id = (field: string, required = true) => {
    const v = body[field];
    if (v === undefined || v === "") {
      if (required) errors.push(`${field} is required`);
      return undefined;
    }
    if (typeof v !== "string" || !ID.test(v))
      errors.push(`${field} must match ${ID}`);
    return v as string;
  };

  if (body.type !== "GIFT_CARD" && body.type !== "TOPUP")
    errors.push("type must be GIFT_CARD or TOPUP");
  const supplierId = id("supplierId");
  const productId = id("productId");
  const customerId = id("customerId");

  const amount = body.amount;
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > MAX_AMOUNT
  ) {
    errors.push(`amount must be a number in (0, ${MAX_AMOUNT}]`);
  } else if (Math.round(amount * 100) !== amount * 100) {
    errors.push("amount must have at most 2 decimals");
  }

  const currency = body.currency ?? "USD";
  if (typeof currency !== "string" || !CURRENCY.test(currency))
    errors.push("currency must be an ISO 4217 code");

  const topup = body.type === "TOPUP";
  const gameId = id("gameId", topup);
  const playerId = id("playerId", topup);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: body.type as OrderType,
      supplierId: supplierId!,
      productId: productId!,
      amount: amount as number,
      currency: currency as string,
      customerId: customerId!,
      ...(topup ? { gameId, playerId } : {}),
    },
  };
}
