import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "./clients";
import { tableName } from "./env";
import {
  GSI_CUSTOMER,
  GSI_STATUS,
  META,
  customerPk,
  fulfillmentSk,
  orderPk,
  supplierPk,
} from "./keys";
import {
  RETRYABLE_STATUSES,
  type FulfillmentResult,
  type Order,
  type OrderStatus,
  type SupplierConfig,
} from "./types";

export const isConditionalCheckFailed = (err: unknown) =>
  (err as Error).name === "ConditionalCheckFailedException";

export async function putOrder(order: Order): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: orderPk(order.orderId),
        SK: META,
        GSI1PK: customerPk(order.customerId),
        GSI1SK: `ORDER#${order.createdAt}#${order.orderId}`,
        ...order,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );
}

export async function getOrder(orderId: string): Promise<Order | undefined> {
  const res = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: orderPk(orderId), SK: META },
    }),
  );
  return res.Item as Order | undefined;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  extra: Partial<Order> = {},
  remove: (keyof Order)[] = [],
): Promise<boolean> {
  const attrs: Record<string, unknown> = {
    ...extra,
    status,
    updatedAt: new Date().toISOString(),
  };
  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = { ":delivered": "DELIVERED" };
  const entries = Object.entries(attrs).filter(([, v]) => v !== undefined);
  const sets = entries.map(([k, v], i) => {
    names[`#k${i}`] = k;
    values[`:v${i}`] = v;
    return `#k${i} = :v${i}`;
  });
  const removes = remove.map((k, i) => {
    names[`#r${i}`] = k;
    return `#r${i}`;
  });
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: orderPk(orderId), SK: META },
        UpdateExpression: `SET ${sets.join(", ")}${removes.length ? ` REMOVE ${removes.join(", ")}` : ""}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(PK) AND #status <> :delivered",
      }),
    );
    return true;
  } catch (err) {
    if (!isConditionalCheckFailed(err)) throw err;
    if (status === "DELIVERED") return true; // already delivered: idempotent no-op
    console.warn("order status update rejected", { orderId, status });
    return false;
  }
}

export async function saveTaskToken(
  orderId: string,
  taskToken: string,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: orderPk(orderId), SK: META },
      UpdateExpression: "SET taskToken = :t",
      ExpressionAttributeValues: { ":t": taskToken },
      ConditionExpression: "attribute_exists(PK)",
    }),
  );
}

export async function claimRetry(orderId: string): Promise<Order | undefined> {
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: orderPk(orderId), SK: META },
        UpdateExpression:
          "SET #status = :pending, updatedAt = :now ADD retries :one REMOVE taskToken",
        ConditionExpression: "#status IN (:s0, :s1)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":pending": "PENDING",
          ":now": new Date().toISOString(),
          ":one": 1,
          ":s0": RETRYABLE_STATUSES[0],
          ":s1": RETRYABLE_STATUSES[1],
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return res.Attributes as Order;
  } catch (err) {
    if (isConditionalCheckFailed(err)) return undefined;
    throw err;
  }
}

export async function listOrdersByCustomer(
  customerId: string,
): Promise<Order[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: GSI_CUSTOMER,
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": customerPk(customerId) },
      ScanIndexForward: false,
    }),
  );
  return (res.Items ?? []) as Order[];
}

export async function listOrdersByStatus(
  status: OrderStatus,
  limit = 100,
): Promise<Order[]> {
  const res = await ddb.send(
    new QueryCommand({ ...statusQuery(status), Limit: limit }),
  );
  return (res.Items ?? []) as Order[];
}

export async function listAllOrdersByStatus(
  status: OrderStatus,
): Promise<Order[]> {
  const items: Order[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({ ...statusQuery(status), ExclusiveStartKey }),
    );
    items.push(...((res.Items ?? []) as Order[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

const statusQuery = (status: OrderStatus): QueryCommandInput => ({
  TableName: tableName(),
  IndexName: GSI_STATUS,
  KeyConditionExpression: "#s = :s",
  ExpressionAttributeNames: { "#s": "status" },
  ExpressionAttributeValues: { ":s": status },
  ScanIndexForward: false,
});

export async function putFulfillmentRecord(
  orderId: string,
  result: FulfillmentResult,
): Promise<boolean> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: orderPk(orderId),
          SK: fulfillmentSk(result.supplierOrderId),
          ...result,
          recordedAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
    return true;
  } catch (err) {
    if (isConditionalCheckFailed(err)) return false;
    throw err;
  }
}

export async function getFulfillmentRecord(
  orderId: string,
  supplierOrderId: string,
): Promise<FulfillmentResult | undefined> {
  const res = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: orderPk(orderId), SK: fulfillmentSk(supplierOrderId) },
    }),
  );
  return res.Item as FulfillmentResult | undefined;
}

export async function getSupplier(
  supplierId: string,
): Promise<SupplierConfig | undefined> {
  const res = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: supplierPk(supplierId), SK: META },
    }),
  );
  return res.Item as SupplierConfig | undefined;
}

export async function listSuppliers(): Promise<SupplierConfig[]> {
  const items: SupplierConfig[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName(),
        FilterExpression: "entityType = :t",
        ExpressionAttributeValues: { ":t": "SUPPLIER" },
        ExclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as SupplierConfig[]));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function recordSupplierFailure(
  supplierId: string,
  threshold: number,
): Promise<boolean> {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: supplierPk(supplierId), SK: META },
      UpdateExpression: "ADD consecutiveFailures :one",
      ExpressionAttributeValues: { ":one": 1 },
      ConditionExpression: "attribute_exists(PK)",
      ReturnValues: "ALL_NEW",
    }),
  );
  const failures = Number(res.Attributes?.consecutiveFailures ?? 0);
  if (failures < threshold) return false;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: supplierPk(supplierId), SK: META },
        UpdateExpression: "SET active = :f, circuitOpenedAt = :now",
        ConditionExpression: "active = :t",
        ExpressionAttributeValues: {
          ":f": false,
          ":t": true,
          ":now": new Date().toISOString(),
        },
      }),
    );
    return true;
  } catch (err) {
    if (isConditionalCheckFailed(err)) return false; // already open
    throw err;
  }
}

export async function recordSupplierSuccess(supplierId: string): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: supplierPk(supplierId), SK: META },
        UpdateExpression: "SET consecutiveFailures = :zero",
        ConditionExpression: "consecutiveFailures > :zero",
        ExpressionAttributeValues: { ":zero": 0 },
      }),
    );
  } catch (err) {
    if (!isConditionalCheckFailed(err)) throw err;
  }
}

export async function enableSupplier(supplierId: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: supplierPk(supplierId), SK: META },
      UpdateExpression:
        "SET active = :t, consecutiveFailures = :zero REMOVE circuitOpenedAt",
      ExpressionAttributeValues: { ":t": true, ":zero": 0 },
    }),
  );
}
