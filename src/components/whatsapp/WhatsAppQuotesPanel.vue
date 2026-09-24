<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import { getFlightRequest, getFlightRequests } from "@/services/whatsappApi";
import { formatTimestamp, statusLabels, tripLabels } from "@/utils/whatsappDisplay";

const quotes = ref([]);
const selected = ref(null);
const loading = ref(false);
const detailLoading = ref(false);
const error = ref("");
const detailError = ref("");
const filters = ref({ search: "", origin: "", destination: "", aircraft: "", status: "", date: "" });
let listController;
let detailController;

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "collecting", label: "Recolectando" },
  { value: "confirmed", label: "Confirmada" },
  { value: "quoted", label: "Registrada" },
  { value: "cancelled", label: "Cancelada" },
];

const selectedRows = computed(() => {
  const quote = selected.value;
  if (!quote) return [];
  return [
    ["Cliente", quote.client_name || quote.contact?.name],
    ["Telefono", quote.contact?.phone_number],
    ["Correo", quote.client_email],
    ["Empresa", quote.company],
    ["Ruta", quote.route],
    ["Tipo", tripLabels[quote.trip_type] || quote.trip_type],
    ["Salida", [quote.departure_date, quote.departure_time].filter(Boolean).join(" ")],
    ["Regreso", [quote.return_date, quote.return_time].filter(Boolean).join(" ")],
    ["Pasajeros", quote.passengers],
    ["Aeronave", quote.aircraft_name || quote.selected_aircraft],
    ["UUID aeronave", quote.selected_aircraft_id],
    ["Capacidad", quote.aircraft_capacity],
    ["Tiempo estimado", quote.estimated_time],
    ["Horas estimadas", quote.estimated_hours],
    ["Precio aproximado", formatMoney(quote.estimated_price, quote.currency)],
    ["Estado", statusLabels[quote.status] || quote.status],
    ["Referencia", quote.quote_reference],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
});

function formatMoney(value, currency = "USD") {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency || ""}`.trim();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);
}

function cleanParams() {
  return Object.fromEntries(Object.entries(filters.value).filter(([, value]) => String(value || "").trim() !== ""));
}

async function loadQuotes() {
  listController?.abort();
  const controller = new AbortController();
  listController = controller;
  loading.value = true;
  error.value = "";
  try {
    const result = await getFlightRequests({ per_page: 100, signal: controller.signal, ...cleanParams() });
    quotes.value = Array.isArray(result.data) ? result.data : [];
    if (selected.value && !quotes.value.some((quote) => quote.id === selected.value.id)) selected.value = null;
  } catch (err) {
    if (!controller.signal.aborted) error.value = err.message;
  } finally {
    if (listController === controller) loading.value = false;
  }
}

async function openQuote(quote) {
  detailController?.abort();
  const controller = new AbortController();
  detailController = controller;
  selected.value = quote;
  detailLoading.value = true;
  detailError.value = "";
  try {
    const result = await getFlightRequest(quote.id, { signal: controller.signal });
    selected.value = result.data;
  } catch (err) {
    if (!controller.signal.aborted) detailError.value = err.message;
  } finally {
    if (detailController === controller) detailLoading.value = false;
  }
}

onMounted(loadQuotes);
onBeforeUnmount(() => {
  listController?.abort();
  detailController?.abort();
});
</script>

<template>
  <section class="quotes-panel" aria-label="Cotizaciones de WhatsApp">
    <header class="quotes-heading">
      <div>
        <h2>Cotizaciones</h2>
        <p class="muted">Solicitudes registradas desde WhatsApp.</p>
      </div>
      <BaseButton variant="secondary" :disabled="loading" @click="loadQuotes">{{ loading ? "Actualizando..." : "Actualizar" }}</BaseButton>
    </header>

    <form class="quote-filters" @submit.prevent="loadQuotes">
      <input v-model="filters.search" type="search" placeholder="Telefono o cliente">
      <input v-model="filters.origin" type="search" placeholder="Origen">
      <input v-model="filters.destination" type="search" placeholder="Destino">
      <input v-model="filters.aircraft" type="search" placeholder="Aeronave">
      <select v-model="filters.status">
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <input v-model="filters.date" type="date" aria-label="Fecha de vuelo">
      <BaseButton type="submit" :disabled="loading">Filtrar</BaseButton>
    </form>

    <div v-if="error" class="error" role="alert">{{ error }}<button type="button" @click="loadQuotes">Reintentar</button></div>
    <p v-if="loading" class="empty" role="status">Cargando cotizaciones...</p>
    <p v-else-if="!quotes.length && !error" class="empty">No hay cotizaciones de WhatsApp con estos filtros.</p>

    <div v-else class="quote-layout">
      <div class="quote-table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Ruta</th>
              <th>Fecha</th>
              <th>Pasajeros</th>
              <th>Aeronave</th>
              <th>Tiempo</th>
              <th>Precio aproximado</th>
              <th>Estado</th>
              <th>Creada</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="quote in quotes" :key="quote.id" :class="{ selected: selected?.id === quote.id }" @click="openQuote(quote)">
              <td>#{{ quote.id }}</td>
              <td><strong>{{ quote.client_name || quote.contact?.name || "Sin nombre" }}</strong><small>{{ quote.contact?.phone_number }}</small></td>
              <td>{{ quote.route || [quote.origin, quote.destination].filter(Boolean).join(" -> ") }}</td>
              <td>{{ quote.departure_date || "-" }}</td>
              <td>{{ quote.passengers || "-" }}</td>
              <td>{{ quote.aircraft_name || quote.selected_aircraft || "-" }}</td>
              <td>{{ quote.estimated_time || "-" }}</td>
              <td>{{ formatMoney(quote.estimated_price, quote.currency) || "-" }}</td>
              <td><span class="status">{{ statusLabels[quote.status] || quote.status }}</span></td>
              <td>{{ formatTimestamp(quote.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="quote-detail" :aria-busy="detailLoading">
        <p v-if="!selected" class="empty">Selecciona una cotizacion para ver el detalle.</p>
        <template v-else>
          <header>
            <div>
              <h3>Cotizacion WhatsApp #{{ selected.id }}</h3>
              <p class="muted">{{ selected.route }}</p>
            </div>
            <button type="button" aria-label="Cerrar detalle" @click="selected = null">Cerrar</button>
          </header>
          <p v-if="detailLoading" class="empty" role="status">Cargando detalle...</p>
          <p v-if="detailError" class="error" role="alert">{{ detailError }}</p>
          <dl>
            <template v-for="[label, value] in selectedRows" :key="label">
              <dt>{{ label }}</dt>
              <dd>{{ value }}</dd>
            </template>
          </dl>
          <section v-if="selected.pricing_breakdown">
            <h4>Breakdown de pricing</h4>
            <dl>
              <template v-for="(value, key) in selected.pricing_breakdown" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ typeof value === "number" ? formatMoney(value, selected.currency) : value }}</dd>
              </template>
            </dl>
          </section>
          <details v-if="selected.official_quote_payload">
            <summary>Datos adicionales de la cotizacion</summary>
            <dl>
              <template v-for="(value, key) in selected.official_quote_payload" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ typeof value === "object" ? JSON.stringify(value) : value }}</dd>
              </template>
            </dl>
          </details>
        </template>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.quotes-panel { display: flex; flex-direction: column; gap: 16px; color: var(--text-main); }
.quotes-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
h2, h3, h4 { margin: 0; color: var(--text-strong); } h2 { font-size: 1.1rem; } h3 { font-size: 1rem; } h4 { font-size: .85rem; margin-top: 18px; }
.muted { color: var(--text-muted); font-size: .82rem; margin: 6px 0 0; }
.quote-filters { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)) auto; gap: 10px; align-items: center; }
input, select { width: 100%; min-height: 42px; border: 1px solid var(--border-strong); background: var(--bg-soft); border-radius: 10px; padding: 0 11px; color: var(--text-main); font: inherit; font-size: .82rem; }
.quote-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, .7fr); min-height: 560px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-surface-solid); box-shadow: var(--shadow-sm); }
.quote-table-wrap { overflow: auto; }
table { width: 100%; border-collapse: collapse; font-size: .82rem; }
th, td { padding: 12px; border-bottom: 1px solid var(--border-color); text-align: left; vertical-align: top; }
th { position: sticky; top: 0; background: var(--bg-surface-solid); z-index: 1; color: var(--text-muted); font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; }
tr { cursor: pointer; } tbody tr:hover, tbody tr.selected { background: var(--primary-soft); }
td small { display: block; color: var(--text-muted); margin-top: 4px; overflow-wrap: anywhere; }
.status { display: inline-block; padding: 4px 8px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); font-size: .72rem; font-weight: 750; }
.quote-detail { overflow: auto; border-left: 1px solid var(--border-color); padding: 18px; background: var(--bg-soft); }
.quote-detail header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 18px; }
.quote-detail header button, .error button { border: 0; background: transparent; color: var(--primary); cursor: pointer; text-decoration: underline; }
dl { display: grid; grid-template-columns: minmax(100px, .7fr) minmax(0, 1fr); gap: 10px; font-size: .83rem; }
dt { color: var(--text-muted); } dd { margin: 0; overflow-wrap: anywhere; }
section, details { border-top: 1px solid var(--border-color); margin-top: 18px; padding-top: 18px; }
summary { cursor: pointer; color: var(--primary); font-weight: 750; margin-bottom: 12px; }
.empty { padding: 24px; text-align: center; color: var(--text-muted); font-size: .9rem; line-height: 1.6; }
.error { padding: 12px; color: var(--danger); font-size: .85rem; background: var(--bg-surface-solid); overflow-wrap: anywhere; }
@media (max-width: 1200px) { .quote-filters { grid-template-columns: repeat(3, minmax(0, 1fr)); }.quote-layout { grid-template-columns: minmax(0, 1fr); }.quote-detail { border-left: 0; border-top: 1px solid var(--border-color); } }
@media (max-width: 700px) { .quote-filters { grid-template-columns: minmax(0, 1fr); } th, td { padding: 10px; } .quote-detail { padding: 14px; } }
</style>
