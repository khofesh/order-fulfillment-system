output "api_url" {
  description = "Base URL of the Orders API (set as VITE_API_URL in frontend/.env)."
  value       = aws_api_gateway_stage.orders.invoke_url
}

output "api_id" {
  value = aws_api_gateway_rest_api.orders.id
}

output "table_name" {
  value = aws_dynamodb_table.orders.name
}

output "state_machine_arn" {
  value = aws_sfn_state_machine.fulfillment.arn
}

output "dead_letter_queue_url" {
  value = aws_sqs_queue.fulfillment_dlq.url
}

output "notifications_topic_arn" {
  value = aws_sns_topic.order_notifications.arn
}

output "function_names" {
  value = { for k, f in aws_lambda_function.fn : k => f.function_name }
}
