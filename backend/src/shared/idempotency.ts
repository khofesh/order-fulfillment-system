import { createHash, randomUUID } from "node:crypto";

const KEY = /^[A-Za-z0-9_-]{8,128}$/;

export const isValidIdempotencyKey = (key: string) => KEY.test(key);

export function deriveOrderId(
  customerId: string,
  idempotencyKey?: string,
): string {
  if (!idempotencyKey) return randomUUID();
  const h = createHash("sha256")
    .update(`${customerId}\n${idempotencyKey}`)
    .digest("hex");

  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
