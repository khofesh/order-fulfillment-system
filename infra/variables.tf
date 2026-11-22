variable "project" {
  description = "Name prefix for all resources."
  type        = string
  default     = "order-fulfillment"
}

variable "environment" {
  description = "Deployment environment (local, dev, prod, ...)."
  type        = string
  default     = "local"
}

variable "region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "lambda_dist_dir" {
  description = "Directory containing bundled handlers (output of `npm run bundle` in backend/)."
  type        = string
  default     = "../backend/dist"
}

variable "health_check_schedule" {
  description = "EventBridge schedule for supplier health checks (circuit breaker recovery)."
  type        = string
  default     = "rate(5 minutes)"
}

variable "poll_interval_seconds" {
  description = "How long fulfillment waits for a supplier callback before checking the status itself."
  type        = number
  default     = 30
}

variable "max_polls" {
  description = "Status checks before a still-PENDING order is parked as PENDING_RETRY. max_polls * poll_interval_seconds must stay well under the state machine timeout (3600s)."
  type        = number
  default     = 20

  validation {
    condition     = var.max_polls >= 1 && var.max_polls <= 100
    error_message = "max_polls must be between 1 and 100."
  }
}

variable "circuit_breaker_threshold" {
  description = "Consecutive retryable supplier failures that open the supplier's circuit breaker."
  type        = number
  default     = 5
}

variable "max_auto_retries" {
  description = "Times the health check restarts a PENDING_RETRY order before leaving it for ops."
  type        = number
  default     = 3
}

variable "cors_allowed_origin" {
  description = "Access-Control-Allow-Origin for the API, e.g. https://orders.example.com. \"*\" only for local development."
  type        = string
  default     = "*"
}

variable "ops_notification_email" {
  description = "Optional e-mail address subscribed to ops notifications (failures, parked orders, circuit breaker)."
  type        = string
  default     = null
}

variable "suppliers" {
  description = <<-EOT
    Supplier configs written as SUPPLIER#<id> items. Onboarding a supplier that uses an
    existing adapter type is just a new entry here. Keep secrets out of this map:
    reference them in auth_config as <name>SecretArn (apiKeySecretArn, callbackSecretSecretArn),
    pointing at Secrets Manager secrets named "<project>/...".
    mapping:    REST_JSON paths and response fields (fulfillPath, statusPath, healthPath,
                idField, statusField, codeField, redemptionUrlField; dotted paths allowed).
    status_map: supplier status value -> DELIVERED | PENDING | FAILED.
  EOT
  type = map(object({
    adapter_type          = string
    endpoint              = string
    active                = optional(bool, true)
    rate_limit_per_second = optional(number)
    auth_config           = optional(map(string), {})
    mapping               = optional(map(string), {})
    status_map            = optional(map(string), {})
  }))
  default = {
    mock = {
      adapter_type = "MOCK"
      endpoint     = "http://localhost"
    }
  }
}
