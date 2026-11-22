# Circuit breaker recovery: periodically probe suppliers flagged inactive.
resource "aws_cloudwatch_event_rule" "supplier_health_check" {
  name                = "${local.name}-supplier-health-check"
  schedule_expression = var.health_check_schedule
}

resource "aws_cloudwatch_event_target" "supplier_health_check" {
  rule = aws_cloudwatch_event_rule.supplier_health_check.name
  arn  = aws_lambda_function.fn["supplier-health-check"].arn
}

resource "aws_lambda_permission" "supplier_health_check" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["supplier-health-check"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.supplier_health_check.arn
}
