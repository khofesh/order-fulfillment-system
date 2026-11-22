<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useOrdersStore } from '@/stores/orders'
import { RETRYABLE_STATUSES, SETTLED_STATUSES } from '@/types/order'

const props = defineProps<{ orderId: string }>()
const store = useOrdersStore()

/** Interval between background refreshes while fulfillment is in progress. */
const POLL_MS = 2000

let timer: ReturnType<typeof setTimeout> | undefined

const settled = computed(
  () => store.current?.orderId === props.orderId && SETTLED_STATUSES.includes(store.current.status),
)

// Poll until the order settles (DELIVERED / FAILED / PENDING_RETRY), then stop.
async function poll(quiet: boolean) {
  clearTimeout(timer)
  await store.fetchOrder(props.orderId, quiet)
  if (!settled.value && !store.error) timer = setTimeout(() => poll(true), POLL_MS)
}

async function retry() {
  if (await store.retryOrder(props.orderId)) poll(true)
}

watch(
  () => props.orderId,
  () => poll(false),
  { immediate: true },
)
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <section>
    <h2>Order {{ orderId }}</h2>
    <p v-if="store.loading">Loading…</p>
    <p v-else-if="store.error" class="error">{{ store.error }}</p>
    <dl v-else-if="store.current">
      <dt>Status</dt>
      <dd data-test="status">
        <span class="status" :class="`status-${store.current.status}`">{{
          store.current.status
        }}</span
        ><span v-if="!settled"> (updating…)</span>
      </dd>
      <dt>Type</dt>
      <dd>{{ store.current.type }}</dd>
      <dt>Amount</dt>
      <dd>{{ store.current.amount }} {{ store.current.currency }}</dd>
      <template v-if="store.current.code">
        <dt>Code</dt>
        <dd>{{ store.current.code }}</dd>
      </template>
      <template v-if="store.current.redemptionUrl">
        <dt>Redeem at</dt>
        <dd>
          <a :href="store.current.redemptionUrl" rel="noopener" target="_blank">{{
            store.current.redemptionUrl
          }}</a>
        </dd>
      </template>
      <template v-if="store.current.playerId">
        <dt>Player</dt>
        <dd>{{ store.current.gameId }} / {{ store.current.playerId }}</dd>
      </template>
      <template v-if="store.current.lastError">
        <dt>Last error</dt>
        <dd class="error">{{ store.current.lastError }}</dd>
      </template>
      <template v-if="store.current.retries">
        <dt>Retries</dt>
        <dd>{{ store.current.retries }}</dd>
      </template>
    </dl>
    <button @click="poll(false)">Refresh</button>
    <button
      v-if="store.current && RETRYABLE_STATUSES.includes(store.current.status)"
      data-test="retry"
      @click="retry"
    >
      Retry fulfillment
    </button>
  </section>
</template>
