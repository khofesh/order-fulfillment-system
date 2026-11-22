<script setup lang="ts">
import { useOrdersStore } from "@/stores/orders";
import type { CreateOrderRequest } from "@/types/order";
import { reactive } from "vue";
import { useRouter } from "vue-router";

const store = useOrdersStore();
const router = useRouter();

let idempotencyKey = crypto.randomUUID();

const form = reactive<CreateOrderRequest>({
  type: "GIFT_CARD",
  supplierId: "mock",
  productId: "",
  amount: 10,
  currency: "USD",
  customerId: "",
  gameId: "",
  playerId: "",
});

async function submit() {
  const { gameId, playerId, ...base } = form;
  const req: CreateOrderRequest = form.type === "TOPUP" ? { ...base, gameId, playerId } : base;
  const order = await store.createOrder(req, idempotencyKey);
  if (order) {
    idempotencyKey = crypto.randomUUID();
    router.push({ name: "order", params: { orderId: order.orderId } });
  }
}
</script>

<template>
  <section>
    <h2>Place order</h2>
    <form @submit.prevent="submit">
      <label>
        Type
        <select v-model="form.type">
          <option value="GIFT_CARD">Gift card</option>
          <option value="TOPUP">Game top-up</option>
        </select>
      </label>
      <label>Supplier <input v-model="form.supplierId" required /></label>
      <label>Product <input v-model="form.productId" required /></label>
      <label>
        Amount
        <input
          v-model.number="form.amount"
          type="number"
          min="0.01"
          max="10000"
          step="0.01"
          required
        />
      </label>
      <label>Currency <input v-model="form.currency" required /></label>
      <label>Customer ID <input v-model="form.customerId" required /></label>
      <template v-if="form.type === 'TOPUP'">
        <label>Game ID <input v-model="form.gameId" required /></label>
        <label>Player ID <input v-model="form.playerId" required /></label>
      </template>
      <button type="submit" :disabled="store.loading">Submit</button>
    </form>
    <p v-if="store.error" class="error">{{ store.error }}</p>
  </section>
</template>
