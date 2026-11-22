import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const json = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
  },
  body: JSON.stringify(body),
});

export function header(
  event: APIGatewayProxyEvent,
  name: string,
): string | undefined {
  const key = Object.keys(event.headers ?? {}).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key ? (event.headers[key] ?? undefined) : undefined;
}

export const rawBody = (event: APIGatewayProxyEvent): string =>
  event.isBase64Encoded && event.body
    ? Buffer.from(event.body, "base64").toString("utf8")
    : (event.body ?? "");
