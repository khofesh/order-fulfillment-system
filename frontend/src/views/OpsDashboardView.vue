<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import OrderTable from '@/components/OrderTable.vue'
import { useOrdersStore } from '@/stores/orders'
import type { OrderStatus } from '@/types/order'

const statuses: OrderStatus[] = ['PENDING', 'PROCESSING', 'PENDING_RETRY', 'FAILED', 'DELIVERED']

const store = useOrdersStore()
const status = ref<OrderStatus>('FAILED')

// FAILED orders are also in the DLQ (full execution input, for audit); replaying
// one here restarts fulfillment with the order's original idempotency key.
async function retry(orderId: string) {
  await store.retryOrder(orderId)
}

watch(status, (s) => store.fetchOrdersByStatus(s), { immediate: true })
onMounted(() => store.fetchSuppliers())
</script>

<template>
  <section>
    <h2>Ops dashboard</h2>

    <h3>Suppliers</h3>
    <table data-test="suppliers">
      <thead>
        <tr>
          <th>Supplier</th>
          <th>Adapter</th>
          <th>Circuit</th>
          <th>Consecutive failures</th>
          <th>Opened at</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in store.suppliers" :key="s.supplierId">
          <td>{{ s.supplierId }}</td>
          <td>{{ s.adapterType }}</td>
          <td :class="{ error: !s.active }">{{ s.active ? 'closed' : 'OPEN' }}</td>
          <td>{{ s.consecutiveFailures }}</td>
          <td>{{ s.circuitOpenedAt ?? '' }}</td>
        </tr>
      </tbody>
    </table>
    <button @click="store.fetchSuppliers()">Refresh suppliers</button>

    <h3>Orders</h3>
    <label>
      Status
      <select v-model="status">
        <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
      </select>
    </label>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <OrderTable :orders="store.list" show-retry @retry="retry" />
  </section>
</template>
