import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { secrets } from "./clients";
import type { SupplierConfig } from "./types";

// Warm Lambda containers reuse secrets for a few minutes instead of calling
// Secrets Manager on every supplier request.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: string; expires: number }>();

export async function resolveSupplierSecret(
  config: SupplierConfig,
  name: string,
): Promise<string | undefined> {
  const arn = config.authConfig?.[`${name}SecretArn`];
  if (!arn) return config.authConfig?.[name];

  const hit = cache.get(arn);
  if (hit && hit.expires > Date.now()) return hit.value;
  const res = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  const value = res.SecretString ?? "";
  cache.set(arn, { value, expires: Date.now() + TTL_MS });
  return value;
}
