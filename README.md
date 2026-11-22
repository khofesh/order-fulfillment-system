# order-fulfillment-system

## prerequisites

- aws emulator - https://aws.amazon.com/products/developer-tools/emulator/
- docker cli 
- docker engine could be colima or the docker itself
- nodejs
- terraform

## how to

start the emulator:

```shell
make emulator-up
```

deploy 

```shell
make emulator-apply
```

frontend

```shell
cd frontend
echo "EMULATOR_API_ID=$(terraform -chdir=../infra output -raw api_id)" > .env.local
npm install && npm run dev
```

## Place an order

Go to **Place order**, fill in the form and click **Submit**.

### Example: gift card

| Field | Value |
|---|---|
| Type | Gift card |
| Supplier | `mock` |
| Product | `steam-card-10` |
| Amount | `10` |
| Currency | `USD` |
| Customer ID | `cust-1` |

### Example: game top-up

| Field | Value |
|---|---|
| Type | Game top-up |
| Supplier | `mock` |
| Product | `diamonds-500` |
| Amount | `4.99` |
| Currency | `USD` |
| Customer ID | `cust-1` |
| Game ID | `mobile-legends` |
| Player ID | `player-12345` |
