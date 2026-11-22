import { PublishCommand } from "@aws-sdk/client-sns";
import { sns } from "./clients";
import { requireEnv } from "./env";

export async function notify(
  subject: string,
  message: Record<string, unknown>,
  attributes: Record<string, string> = {},
): Promise<void> {
  await sns.send(
    new PublishCommand({
      TopicArn: requireEnv("NOTIFICATIONS_TOPIC_ARN"),
      Subject: subject.slice(0, 100),
      Message: JSON.stringify(message),
      MessageAttributes: Object.fromEntries(
        Object.entries({ kind: "ops", ...attributes }).map(([k, v]) => [
          k,
          { DataType: "String", StringValue: v },
        ]),
      ),
    }),
  );
}
