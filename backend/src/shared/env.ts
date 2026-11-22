export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const tableName = () => requireEnv("TABLE_NAME");
export const stateMachineArn = () => requireEnv("STATE_MACHINE_ARN");
export const circuitBreakerThreshold = () =>
  intEnv("CIRCUIT_BREAKER_THRESHOLD", 5);
export const maxAutoRetries = () => intEnv("MAX_AUTO_RETRIES", 3);
