import { StartExecutionCommand } from "@aws-sdk/client-sfn";
import { sfn } from "./clients";
import { stateMachineArn } from "./env";
import { claimRetry } from "./repository";
import type { Order } from "./types";

export async function startFulfillment(
  order: Pick<Order, "orderId" | "retries">,
): Promise<void> {
  const name = order.retries
    ? `${order.orderId}-retry-${order.retries}`
    : order.orderId;
  try {
    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: stateMachineArn(),
        name,
        input: JSON.stringify({ orderId: order.orderId }),
      }),
    );
  } catch (err) {
    if ((err as Error).name !== "ExecutionAlreadyExists") throw err;
  }
}

export async function restartFulfillment(
  orderId: string,
): Promise<Order | undefined> {
  const order = await claimRetry(orderId);
  if (order) await startFulfillment(order);
  return order;
}
