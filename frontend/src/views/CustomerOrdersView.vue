<script setup lang="ts">
import { ref } from 'vue'
import OrderTable from '@/components/OrderTable.vue'
import { useOrdersStore } from '@/stores/orders'

const store = useOrdersStore()
const customerId = ref('')
</script>

<template>
  <section>
    <h2>Customer order history</h2>
    <form @submit.prevent="store.fetchCustomerOrders(customerId)">
      <input v-model="customerId" placeholder="Customer ID" required />
      <button type="submit" :disabled="store.loading">Search</button>
    </form>
    <p v-if="store.error" class="error">{{ store.error }}</p>
    <OrderTable :orders="store.list" />
  </section>
</template>
