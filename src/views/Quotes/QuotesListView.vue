<script setup>
import { onMounted, ref } from "vue";
import { supabase } from "@/supabase";
import QuoteDetailCard from "./QuoteDetailCard.vue";
import {
  getDisplayRouteCount,
  getDisplayRoutePath,
  getFinalQuoteRoute,
  getPrimaryQuoteRoute,
} from "@/utils/quoteRouteDisplay";

const quotes = ref([]);
const loading = ref(true);
const selectedQuote = ref(null);

const EMPTY_VALUE = "-";

async function fetchQuotes() {
  loading.value = true;

  const { data, error } = await supabase
    .from("quotes")
    .select(`
      *,
      quote_routes (
        id,
        from_airport,
        to_airport,
        passengers,
        aircraft_id,
        estimated_price,
        start_date,
        end_date,
        aircraft_fleet (
          id,
          name,
          cruise_speed_knots,
          iata,
          home_base
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load quotes", error);
    quotes.value = [];
  } else {
    quotes.value = data || [];
  }

  loading.value = false;
}

onMounted(fetchQuotes);

async function deleteQuote(id) {
  if (!window.confirm("Eliminar esta cotizacion?")) return;

  const { error } = await supabase.from("quotes").delete().eq("id", id);

  if (error) {
    console.error("Unable to delete quote", error);
    return;
  }

  quotes.value = quotes.value.filter((quote) => quote.id !== id);

  if (selectedQuote.value?.id === id) {
    selectedQuote.value = null;
  }
}

function getPrimaryRoute(quote) {
  return getPrimaryQuoteRoute(quote);
}

function getFinalRoute(quote) {
  return getFinalQuoteRoute(quote);
}

function getAircraftName(route) {
  return route?.aircraft_fleet?.name || route?.aircraft_id || EMPTY_VALUE;
}

function getRouteCount(quote) {
  return getDisplayRouteCount(quote);
}

function getRoutePath(quote) {
  return getDisplayRoutePath(quote);
}

function formatDateTime(value) {
  if (!value) return EMPTY_VALUE;

  return new Date(value).toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getTotalPrice(quote) {
  if (!quote) return 0;

  if (quote.total_estimated_price != null) {
    return Number(quote.total_estimated_price) || 0;
  }

  if (quote.quote_routes?.length) {
    return quote.quote_routes.reduce(
      (total, route) => total + (Number(route.estimated_price) || 0),
      0,
    );
  }

  return Number(quote.estimated_price) || 0;
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <h1>Cotizaciones</h1>
        <p class="subtitle">Solicitudes del sitio y cotizaciones creadas desde admin</p>
      </div>

      <div class="header-actions">
        <RouterLink to="/quotes/flight/create" class="btn-create">
          Nueva cotizacion de vuelo
        </RouterLink>

        <div class="header-badge">
          {{ quotes.length }} {{ quotes.length === 1 ? "registro" : "registros" }}
        </div>
      </div>
    </header>

    <div v-if="loading" class="state">Cargando cotizaciones...</div>

    <div v-else-if="!quotes.length" class="state state-empty">
      No hay cotizaciones registradas.
    </div>

    <div v-else class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Email</th>
            <th>Telefono</th>
            <th>Tipo</th>
            <th>Ruta</th>
            <th>Destino final</th>
            <th>Salida</th>
            <th>Regreso</th>
            <th>PAX</th>
            <th>Aeronave</th>
            <th>Rutas</th>
            <th>Total</th>
            <th>Mensaje</th>
            <th class="actions-column">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="quote in quotes" :key="quote.id">
            <td>{{ formatDateTime(quote.created_at) }}</td>
            <td>{{ quote.full_name || EMPTY_VALUE }}</td>
            <td>{{ quote.email || EMPTY_VALUE }}</td>
            <td>{{ quote.phone || EMPTY_VALUE }}</td>
            <td>{{ quote.flight_type || EMPTY_VALUE }}</td>
            <td class="route-path">{{ getRoutePath(quote) }}</td>
            <td>{{ getFinalRoute(quote)?.to_airport || EMPTY_VALUE }}</td>
            <td>{{ formatDateTime(getPrimaryRoute(quote)?.start_date) }}</td>
            <td>{{ formatDateTime(getPrimaryRoute(quote)?.end_date) }}</td>
            <td>{{ getPrimaryRoute(quote)?.passengers || EMPTY_VALUE }}</td>
            <td>{{ getAircraftName(getPrimaryRoute(quote)) }}</td>
            <td>{{ getRouteCount(quote) }}</td>
            <td class="price">${{ formatCurrency(getTotalPrice(quote)) }} USD</td>
            <td class="message">{{ quote.message || EMPTY_VALUE }}</td>
            <td class="actions-cell">
              <button class="btn-view" @click="selectedQuote = quote">Ver</button>
              <button class="btn-delete" @click="deleteQuote(quote.id)">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="selectedQuote"
      class="modal-overlay"
      @click.self="selectedQuote = null"
    >
      <div class="modal-card">
        <button class="close-btn" @click="selectedQuote = null">x</button>
        <QuoteDetailCard :quote="selectedQuote" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h1 {
  margin: 0;
}

.subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.header-badge {
  padding: 0.55rem 0.8rem;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  font-size: 0.85rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-create {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #0f5fa6, #0b4c86);
  color: white;
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
}

.state {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  background: var(--bg-card);
  border-radius: 14px;
}

.state-empty {
  border: 1px dashed var(--border-color);
}

.table-wrapper {
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 1720px;
  background: var(--bg-card);
  border-radius: 14px;
  border-collapse: separate;
  border-spacing: 0;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
}

.table th,
.table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
  text-align: left;
  vertical-align: top;
}

.table thead {
  background: linear-gradient(
    180deg,
    var(--primary-dark),
    var(--primary-dark-2)
  );
  color: white;
}

.table tbody tr:hover {
  background: var(--bg-hover);
}

.price {
  white-space: nowrap;
  font-weight: 700;
  color: #2563eb;
}

.message {
  min-width: 220px;
  max-width: 320px;
  color: var(--text-muted);
}

.actions-column,
.actions-cell {
  text-align: right;
}

.actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  white-space: nowrap;
}

.btn-view,
.btn-delete {
  border: none;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  color: white;
  font-weight: 600;
}

.btn-view {
  background: #2563eb;
}

.btn-delete {
  background: #dc2626;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1.5rem;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 1080px;
  max-height: 94vh;
  overflow-y: auto;
  padding: 1.1rem;
  border-radius: 16px;
  background: #e8eef5;
  box-shadow: 0 25px 80px rgba(15, 23, 42, 0.35);
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  border: none;
  background: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
  }

  .header-badge {
    align-self: flex-start;
  }
}
</style>
