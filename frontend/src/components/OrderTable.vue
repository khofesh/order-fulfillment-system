<script setup lang="ts">
import { RETRYABLE_STATUSES, type Order } from '@/types/order'

defineProps<{ orders: Order[]; showRetry?: boolean }>()
defineEmits<{ retry: [orderId: string] }>()
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>Order</th>
        <th>Type</th>
        <th>Status</th>
        <th>Supplier</th>
        <th>Amount</th>
        <th>Created</th>
        <th v-if="showRetry">Last error</th>
        <th v-if="showRetry"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="order in orders" :key="order.orderId">
        <td>
          <RouterLink :to="{ name: 'order', params: { orderId: order.orderId } }">
            {{ order.orderId.slice(0, 8) }}
          </RouterLink>
        </td>
        <td>{{ order.type }}</td>
        <td>
          <span class="status" :class="`status-${order.status}`">{{ order.status }}</span>
        </td>
        <td>{{ order.supplierId }}</td>
        <td>{{ order.amount }} {{ order.currency }}</td>
        <td>{{ order.createdAt }}</td>
        <td v-if="showRetry">{{ order.lastError }}</td>
        <td v-if="showRetry">
          <button
            v-if="RETRYABLE_STATUSES.includes(order.status)"
            @click="$emit('retry', order.orderId)"
          >
            Retry
          </button>
        </td>
      </tr>
      <tr v-if="orders.length === 0">
        <td :colspan="showRetry ? 8 : 6">No orders</td>
      </tr>
    </tbody>
  </table>
</template>
