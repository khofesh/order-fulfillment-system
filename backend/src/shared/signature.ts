import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-signature";

export const sign = (secret: string, body: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

export function verifySignature(
  secret: string,
  body: string,
  signature: string | undefined,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(secret, body));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
