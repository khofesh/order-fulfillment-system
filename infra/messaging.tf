resource "aws_sqs_queue" "fulfillment_dlq" {
  name                      = "${local.name}-fulfillment-dlq"
  message_retention_seconds = 14 * 24 * 60 * 60
}

resource "aws_sns_topic" "order_notifications" {
  name = "${local.name}-order-notifications"
}

resource "aws_sns_topic_subscription" "ops_email" {
  count = var.ops_notification_email == null ? 0 : 1

  topic_arn = aws_sns_topic.order_notifications.arn
  protocol  = "email"
  endpoint  = var.ops_notification_email
  filter_policy = jsonencode({ status = [{ "anything-but" = ["DELIVERED"] }] })
}
