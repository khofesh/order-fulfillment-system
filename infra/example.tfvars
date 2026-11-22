environment = "dev"

suppliers = {
  mock = {
    adapter_type = "MOCK"
    endpoint     = "http://localhost"
  }
  # acme = {
  #   adapter_type          = "REST_JSON"
  #   endpoint              = "https://api.acme-giftcards.example"
  #   rate_limit_per_second = 10
  #   auth_config           = { secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:acme" }
  # }
}
