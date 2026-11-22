import PlaceOrderView from "@/views/PlaceOrderView.vue";
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "place-order", component: PlaceOrderView },
    {
      path: "/orders/:orderId",
      name: "order",
      component: () => import("@/views/OrderDetailView.vue"),
      props: true,
    },
    {
      path: "/customers",
      name: "customer-orders",
      component: () => import("@/views/CustomerOrdersView.vue"),
    },
    { path: "/ops", name: "ops", component: () => import("@/views/OpsDashboardView.vue") },
  ],
});

export default router;
