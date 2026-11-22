import { ordersApi } from "@/api/orders";
import type { CreateOrderRequest, Order, OrderStatus, SupplierStatus } from "@/types/order";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useOrdersStore = defineStore("orders", () => {
  const current = ref<Order | null>(null);
  const list = ref<Order[]>([]);
  const suppliers = ref<SupplierStatus[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  async function run<T>(fn: () => Promise<T>, quiet = false): Promise<T | undefined> {
    if (!quiet) loading.value = true;
    error.value = null;
    try {
      return await fn();
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      if (!quiet) loading.value = false;
    }
  }

  const createOrder = (req: CreateOrderRequest, idempotencyKey: string) =>
    run(async () => (current.value = await ordersApi.create(req, idempotencyKey)));

  const fetchOrder = (orderId: string, quiet = false) =>
    run(async () => (current.value = await ordersApi.get(orderId)), quiet);

  const fetchCustomerOrders = (customerId: string) =>
    run(async () => (list.value = (await ordersApi.listByCustomer(customerId)).items));

  const fetchOrdersByStatus = (status: OrderStatus) =>
    run(async () => (list.value = (await ordersApi.listByStatus(status)).items));

  const fetchSuppliers = () =>
    run(async () => (suppliers.value = (await ordersApi.listSuppliers()).items), true);

  const retryOrder = (orderId: string) =>
    run(async () => {
      const order = await ordersApi.retry(orderId);
      if (current.value?.orderId === orderId) current.value = order;
      list.value = list.value.filter((o) => o.orderId !== orderId);
      return order;
    });

  return {
    current,
    list,
    suppliers,
    loading,
    error,
    createOrder,
    fetchOrder,
    fetchCustomerOrders,
    fetchOrdersByStatus,
    fetchSuppliers,
    retryOrder,
  };
});
