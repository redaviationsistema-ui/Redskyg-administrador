<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import QuoteDetailCard from "./QuoteDetailCard.vue";
import { getQuoteById } from "@/services/quotes.service";

const route = useRoute();
const quote = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    quote.value = await getQuoteById(route.params.id);
  } catch (error) {
    console.error("Unable to load quote", error);
    quote.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="detail-page">
    <div v-if="loading" class="state">Cargando cotizacion...</div>
    <div v-else-if="!quote" class="state">No se pudo cargar la cotizacion.</div>
    <QuoteDetailCard v-else :quote="quote" />
  </section>
</template>

<style scoped>
.detail-page {
  width: 100%;
}

.state {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  background: var(--bg-card);
  border-radius: 14px;
}
</style>
