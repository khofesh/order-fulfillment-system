data "aws_iam_policy_document" "sfn_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "state_machine" {
  name               = "${local.name}-fulfillment-sfn"
  assume_role_policy = data.aws_iam_policy_document.sfn_assume.json
}

data "aws_iam_policy_document" "state_machine" {
  statement {
    actions = ["lambda:InvokeFunction"]
    resources = flatten([
      for fn in ["supplier-adapter", "update-order"] :
      [aws_lambda_function.fn[fn].arn, "${aws_lambda_function.fn[fn].arn}:*"]
    ])
  }
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.fulfillment_dlq.arn]
  }
}

resource "aws_iam_role_policy" "state_machine" {
  name   = "fulfillment"
  role   = aws_iam_role.state_machine.id
  policy = data.aws_iam_policy_document.state_machine.json
}

resource "aws_sfn_state_machine" "fulfillment" {
  name     = local.state_machine_name
  role_arn = aws_iam_role.state_machine.arn

  definition = templatefile("${path.module}/statemachine/fulfillment.asl.json", {
    supplier_adapter_arn  = aws_lambda_function.fn["supplier-adapter"].arn
    update_order_arn      = aws_lambda_function.fn["update-order"].arn
    dlq_url               = aws_sqs_queue.fulfillment_dlq.url
    poll_interval_seconds = var.poll_interval_seconds
    max_polls             = var.max_polls
  })

  lifecycle {
    precondition {
      # Worst-case polling must finish before the execution timeout (TimeoutSeconds in the ASL).
      condition     = var.max_polls * var.poll_interval_seconds < 3600
      error_message = "max_polls * poll_interval_seconds must be below 3600 seconds."
    }
  }
}
