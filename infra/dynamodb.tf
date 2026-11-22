resource "aws_dynamodb_table" "orders" {
  name         = "${local.name}-orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "GSI1PK"
    type = "S"
  }
  attribute {
    name = "GSI1SK"
    type = "S"
  }
  attribute {
    name = "status"
    type = "S"
  }
  attribute {
    name = "createdAt"
    type = "S"
  }

  # GSI1: customer order history
  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"
    key_schema {
      attribute_name = "GSI1PK"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "GSI1SK"
      key_type       = "RANGE"
    }
  }

  # GSI2: ops view of orders by status
  global_secondary_index {
    name            = "GSI2"
    projection_type = "ALL"
    key_schema {
      attribute_name = "status"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "createdAt"
      key_type       = "RANGE"
    }
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }
}

resource "aws_dynamodb_table_item" "supplier" {
  for_each = var.suppliers

  table_name = aws_dynamodb_table.orders.name
  hash_key   = aws_dynamodb_table.orders.hash_key
  range_key  = aws_dynamodb_table.orders.range_key

  item = jsonencode(merge(
    {
      PK          = { S = "SUPPLIER#${each.key}" }
      SK          = { S = "META" }
      entityType  = { S = "SUPPLIER" }
      supplierId  = { S = each.key }
      adapterType = { S = each.value.adapter_type }
      endpoint    = { S = each.value.endpoint }
      active      = { BOOL = each.value.active }
    },
    length(each.value.auth_config) > 0 ? {
      authConfig = { M = { for k, v in each.value.auth_config : k => { S = v } } }
    } : {},
    length(each.value.mapping) > 0 ? {
      mapping = { M = { for k, v in each.value.mapping : k => { S = v } } }
    } : {},
    length(each.value.status_map) > 0 ? {
      statusMap = { M = { for k, v in each.value.status_map : k => { S = v } } }
    } : {},
    each.value.rate_limit_per_second != null ? {
      rateLimitPerSecond = { N = tostring(each.value.rate_limit_per_second) }
    } : {},
  ))

  # The circuit breaker flips `active` at runtime
  lifecycle {
    ignore_changes = [item]
  }
}
