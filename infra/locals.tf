locals {
  name       = "${var.project}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition

  state_machine_name = "${local.name}-fulfillment"
  state_machine_arn  = "arn:${local.partition}:states:${var.region}:${local.account_id}:stateMachine:${local.state_machine_name}"

  table_arns = [aws_dynamodb_table.orders.arn, "${aws_dynamodb_table.orders.arn}/index/*"]

  ddb_read  = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:Scan"]
  ddb_write = ["dynamodb:PutItem", "dynamodb:UpdateItem"]

  supplier_secret_arns = ["arn:${local.partition}:secretsmanager:${var.region}:${local.account_id}:secret:${var.project}/*"]

  sfn_start    = { actions = ["states:StartExecution"], resources = [local.state_machine_arn] }
  sfn_callback = { actions = ["states:SendTaskSuccess"], resources = [local.state_machine_arn] }
  sns_publish  = { actions = ["sns:Publish"], resources = [aws_sns_topic.order_notifications.arn] }
  secrets_read = { actions = ["secretsmanager:GetSecretValue"], resources = local.supplier_secret_arns }
  ddb_rw       = { actions = concat(local.ddb_read, local.ddb_write), resources = local.table_arns }

  common_env = {
    CORS_ALLOW_ORIGIN = var.cors_allowed_origin
  }

  functions = {
    "create-order" = {
      env        = { STATE_MACHINE_ARN = local.state_machine_arn }
      statements = [local.ddb_rw, local.sfn_start]
    }
    "get-order" = {
      env        = {}
      statements = [{ actions = local.ddb_read, resources = local.table_arns }]
    }
    "supplier-adapter" = {
      env = {
        CIRCUIT_BREAKER_THRESHOLD = tostring(var.circuit_breaker_threshold)
        NOTIFICATIONS_TOPIC_ARN   = aws_sns_topic.order_notifications.arn
      }
      statements = [local.ddb_rw, local.sfn_callback, local.sns_publish, local.secrets_read]
    }
    "update-order" = {
      env        = { NOTIFICATIONS_TOPIC_ARN = aws_sns_topic.order_notifications.arn }
      statements = [local.ddb_rw, local.sns_publish]
    }
    "supplier-callback" = {
      env        = {}
      statements = [local.ddb_rw, local.sfn_callback, local.secrets_read]
    }
    "supplier-health-check" = {
      env = {
        STATE_MACHINE_ARN = local.state_machine_arn
        MAX_AUTO_RETRIES  = tostring(var.max_auto_retries)
      }
      statements = [local.ddb_rw, local.sfn_start, local.secrets_read]
    }
    "ops" = {
      env        = { STATE_MACHINE_ARN = local.state_machine_arn }
      statements = [local.ddb_rw, local.sfn_start]
    }
  }
}
