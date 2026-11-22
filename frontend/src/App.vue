<script setup lang="ts"></script>

<template>
  <header>
    <h1>Order Fulfillment</h1>
    <nav>
      <RouterLink to="/">Place order</RouterLink>
      <RouterLink to="/customers">Customer orders</RouterLink>
      <RouterLink to="/ops">Ops dashboard</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>
