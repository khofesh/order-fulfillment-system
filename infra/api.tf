locals {
  # Routes -> handler. Lambda proxy integration; CORS headers come from the handlers.
  routes = {
    "/orders"                        = { post = "create-order" }
    "/orders/{orderId}"              = { get = "get-order" }
    "/customers/{customerId}/orders" = { get = "get-order" }
    "/ops/orders"                    = { get = "get-order" }
    "/ops/orders/{orderId}/retry"    = { post = "ops" }
    "/ops/suppliers"                 = { get = "ops" }
    "/callbacks/{supplierId}"        = { post = "supplier-callback" }
  }

  api_functions = toset(flatten([for r in values(local.routes) : values(r)]))

  cors_preflight = {
    options = {
      responses = {
        "200" = {
          description = "CORS preflight"
          headers = {
            "Access-Control-Allow-Origin"  = { schema = { type = "string" } }
            "Access-Control-Allow-Methods" = { schema = { type = "string" } }
            "Access-Control-Allow-Headers" = { schema = { type = "string" } }
          }
        }
      }
      "x-amazon-apigateway-integration" = {
        type             = "mock"
        requestTemplates = { "application/json" = "{\"statusCode\": 200}" }
        responses = {
          default = {
            statusCode = "200"
            responseParameters = {
              "method.response.header.Access-Control-Allow-Origin"  = "'${var.cors_allowed_origin}'"
              "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS'"
              "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,Idempotency-Key'"
            }
          }
        }
      }
    }
  }

  openapi = {
    openapi = "3.0.1"
    info    = { title = "${local.name}-api", version = "1.0" }
    paths = {
      for path, methods in local.routes : path => merge(
        {
          for method, fn in methods : method => {
            "x-amazon-apigateway-integration" = {
              type       = "aws_proxy"
              httpMethod = "POST"
              uri        = aws_lambda_function.fn[fn].invoke_arn
            }
          }
        },
        local.cors_preflight,
      )
    }
  }
}

resource "aws_api_gateway_rest_api" "orders" {
  name = "${local.name}-api"
  body = jsonencode(local.openapi)

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_deployment" "orders" {
  rest_api_id = aws_api_gateway_rest_api.orders.id

  triggers = {
    redeploy = sha1(aws_api_gateway_rest_api.orders.body)
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "orders" {
  rest_api_id   = aws_api_gateway_rest_api.orders.id
  deployment_id = aws_api_gateway_deployment.orders.id
  stage_name    = var.environment
}

resource "aws_lambda_permission" "api" {
  for_each = local.api_functions

  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.orders.execution_arn}/*/*"
}
