import type { CreateOrderRequest, Order, OrderStatus, SupplierStatus } from '@/types/order'

const baseUrl = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const details = Array.isArray(body.errors) ? `: ${body.errors.join(', ')}` : ''
    throw new Error(`${body.message ?? `Request failed with ${res.status}`}${details}`)
  }
  return body as T
}

export const ordersApi = {
  /** Resending with the same idempotency key returns the original order, never a duplicate. */
  create: (req: CreateOrderRequest, idempotencyKey: string) =>
    request<Order>('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(req),
    }),
  get: (orderId: string) => request<Order>(`/orders/${encodeURIComponent(orderId)}`),
  listByCustomer: (customerId: string) =>
    request<{ items: Order[] }>(`/customers/${encodeURIComponent(customerId)}/orders`),
  listByStatus: (status: OrderStatus) =>
    request<{ items: Order[] }>(`/ops/orders?status=${status}`),
  retry: (orderId: string) =>
    request<Order>(`/ops/orders/${encodeURIComponent(orderId)}/retry`, { method: 'POST' }),
  listSuppliers: () => request<{ items: SupplierStatus[] }>('/ops/suppliers'),
}
