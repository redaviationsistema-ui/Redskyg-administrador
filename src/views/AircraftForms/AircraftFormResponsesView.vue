<script setup>
import { computed, onMounted, ref } from "vue";
import { supabase } from "@/supabase";

const responses = ref([]);
const loading = ref(true);
const selectedResponse = ref(null);
const search = ref("");
const aircraftFilter = ref("all");

const EMPTY_VALUE = "-";

const aircraftOptions = computed(() => {
  const names = new Set(responses.value.map((item) => item.aircraft).filter(Boolean));
  return ["all", ...Array.from(names).sort()];
});

const filteredResponses = computed(() => {
  const term = search.value.trim().toLowerCase();

  return responses.value.filter((item) => {
    const matchesAircraft =
      aircraftFilter.value === "all" || item.aircraft === aircraftFilter.value;

    if (!term) return matchesAircraft;

    const haystack = [
      item.full_name,
      item.email,
      item.phone_whatsapp,
      item.aircraft,
      item.company_group,
      item.state_of_operation,
      item.budget_range,
      item.purchase_stage,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesAircraft && haystack.includes(term);
  });
});

async function fetchResponses() {
  loading.value = true;

  const { data, error } = await supabase
    .from("pilatus_pc12_qualification_forms")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load aircraft form responses", error);
    responses.value = [];
  } else {
    responses.value = data || [];
  }

  loading.value = false;
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

function formatPriorities(value) {
  if (Array.isArray(value)) return value.join(" | ");
  if (typeof value === "string") return value || EMPTY_VALUE;
  return EMPTY_VALUE;
}

function getInitials(name) {
  if (!name) return "NA";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

onMounted(fetchResponses);
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <span class="eyebrow">Forms de aviones</span>
        <h1>Respuestas de vuelos </h1>
        <p class="subtitle">
          Prospectos recibidos desde vuelos  de aeronaves como Pilatus PC-12 2008.
        </p>
      </div>

      <div class="header-badge">
        {{ filteredResponses.length }} {{ filteredResponses.length === 1 ? "respuesta" : "respuestas" }}
      </div>
    </header>

    <div class="stats-grid">
      <article class="stat-card">
        <span>Total respuestas</span>
        <strong>{{ responses.length }}</strong>
      </article>
      <article class="stat-card">
        <span>Aeronaves</span>
        <strong>{{ Math.max(aircraftOptions.length - 1, 0) }}</strong>
      </article>
      <article class="stat-card">
        <span>Ultimo registro</span>
        <strong>{{ formatDateTime(responses[0]?.created_at) }}</strong>
      </article>
    </div>

    <section class="filters-card">
      <label class="filter-field">
        <span>Buscar</span>
        <input v-model="search" type="search" placeholder="Nombre, email, telefono, estado..." />
      </label>

      <label class="filter-field">
        <span>Aeronave</span>
        <select v-model="aircraftFilter">
          <option v-for="aircraft in aircraftOptions" :key="aircraft" :value="aircraft">
            {{ aircraft === "all" ? "Todas" : aircraft }}
          </option>
        </select>
      </label>

      <button class="btn-refresh" type="button" @click="fetchResponses">
        Actualizar
      </button>
    </section>

    <div v-if="loading" class="state">Cargando respuestas...</div>

    <div v-else-if="!filteredResponses.length" class="state state-empty">
      No hay respuestas registradas.
    </div>

    <div v-else class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Prospecto</th>
            <th>Aeronave</th>
            <th>Estado</th>
            <th>Presupuesto</th>
            <th>Etapa</th>
            <th>Timeline</th>
            <th>Operacion</th>
            <th>Prioridades</th>
            <th class="actions-column">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="item in filteredResponses" :key="item.id">
            <td>{{ formatDateTime(item.created_at) }}</td>
            <td>
              <div class="person-cell">
                <span class="avatar">{{ getInitials(item.full_name) }}</span>
                <div>
                  <strong>{{ item.full_name || EMPTY_VALUE }}</strong>
                  <small>{{ item.email || EMPTY_VALUE }}</small>
                  <small>{{ item.phone_whatsapp || EMPTY_VALUE }}</small>
                </div>
              </div>
            </td>
            <td>{{ item.aircraft || EMPTY_VALUE }}</td>
            <td>{{ item.state_of_operation || EMPTY_VALUE }}</td>
            <td class="budget">{{ item.budget_range || EMPTY_VALUE }}</td>
            <td>{{ item.purchase_stage || EMPTY_VALUE }}</td>
            <td>{{ item.estimated_timeline || EMPTY_VALUE }}</td>
            <td>{{ item.operation_type || EMPTY_VALUE }}</td>
            <td class="priorities">{{ formatPriorities(item.purchase_priorities) }}</td>
            <td class="actions-cell">
              <button class="btn-view" type="button" @click="selectedResponse = item">
                Ver
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="selectedResponse"
      class="modal-overlay"
      @click.self="selectedResponse = null"
    >
      <article class="modal-card">
        <button class="close-btn" type="button" @click="selectedResponse = null">
          x
        </button>

        <header class="modal-header">
          <span>{{ selectedResponse.aircraft || "Formulario de aeronave" }}</span>
          <h2>{{ selectedResponse.full_name || "Prospecto sin nombre" }}</h2>
          <p>{{ formatDateTime(selectedResponse.created_at) }}</p>
        </header>

        <div class="detail-grid">
          <div class="detail-item">
            <span>Empresa / Grupo</span>
            <strong>{{ selectedResponse.company_group || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Email</span>
            <strong>{{ selectedResponse.email || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Telefono / WhatsApp</span>
            <strong>{{ selectedResponse.phone_whatsapp || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Estado de operacion</span>
            <strong>{{ selectedResponse.state_of_operation || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Tipo de compra</span>
            <strong>{{ selectedResponse.purchase_type || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Propietario previo</span>
            <strong>{{ selectedResponse.previous_aircraft_owner || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Aeronave previa</span>
            <strong>{{ selectedResponse.previous_aircraft || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Etapa de compra</span>
            <strong>{{ selectedResponse.purchase_stage || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Tiempo estimado</span>
            <strong>{{ selectedResponse.estimated_timeline || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Presupuesto</span>
            <strong>{{ selectedResponse.budget_range || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Financiamiento</span>
            <strong>{{ selectedResponse.financing_considered || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Capital LOI</span>
            <strong>{{ selectedResponse.loi_capital_available || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Base de operacion</span>
            <strong>{{ selectedResponse.operation_base || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Tipo de operacion</span>
            <strong>{{ selectedResponse.operation_type || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Horas anuales</span>
            <strong>{{ selectedResponse.estimated_annual_hours || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Rutas</span>
            <strong>{{ selectedResponse.route_profile || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item full">
            <span>Prioridades</span>
            <strong>{{ formatPriorities(selectedResponse.purchase_priorities) }}</strong>
          </div>
          <div class="detail-item">
            <span>NDA / LOI</span>
            <strong>{{ selectedResponse.nda_loi_willing || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item">
            <span>Proyeccion financiera</span>
            <strong>{{ selectedResponse.financial_projection_requested || EMPTY_VALUE }}</strong>
          </div>
          <div class="detail-item full">
            <span>Comentarios</span>
            <strong>{{ selectedResponse.additional_comments || EMPTY_VALUE }}</strong>
          </div>
        </div>
      </article>
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
  margin-bottom: 1.4rem;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 0.45rem;
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 0;
  color: var(--text-strong);
}

.subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.92rem;
  color: var(--text-muted);
}

.header-badge,
.btn-refresh {
  padding: 0.6rem 0.85rem;
  border-radius: 999px;
  background: rgba(15, 95, 166, 0.1);
  color: var(--primary);
  font-size: 0.85rem;
  font-weight: 800;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-card,
.filters-card,
.table,
.modal-card {
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.stat-card {
  padding: 1rem;
  border-radius: 18px;
}

.stat-card span {
  display: block;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.stat-card strong {
  display: block;
  margin-top: 0.45rem;
  color: var(--text-strong);
  font-size: 1.25rem;
}

.filters-card {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(180px, 260px) auto;
  gap: 0.85rem;
  align-items: end;
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 18px;
}

.filter-field {
  display: grid;
  gap: 0.35rem;
}

.filter-field span {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.filter-field input,
.filter-field select {
  min-height: 42px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-soft);
  color: var(--text-main);
  padding: 0 0.8rem;
}

.btn-refresh {
  min-height: 42px;
  border: none;
  cursor: pointer;
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
  min-width: 1380px;
  border-radius: 18px;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
}

.table th,
.table td {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.84rem;
  text-align: left;
  vertical-align: top;
}

.table thead {
  background: linear-gradient(180deg, var(--primary-dark), var(--primary-dark-2));
  color: white;
}

.table tbody tr:hover {
  background: var(--bg-hover);
}

.person-cell {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  min-width: 230px;
}

.avatar {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 14px;
  background: linear-gradient(135deg, #0f5fa6, #0b4c86);
  color: white;
  font-size: 0.75rem;
  font-weight: 900;
}

.person-cell strong,
.person-cell small {
  display: block;
}

.person-cell strong {
  color: var(--text-strong);
}

.person-cell small,
.priorities {
  color: var(--text-muted);
}

.budget {
  color: var(--primary);
  font-weight: 800;
  white-space: nowrap;
}

.priorities {
  min-width: 260px;
}

.actions-column,
.actions-cell {
  text-align: right;
}

.btn-view {
  border: none;
  padding: 0.5rem 0.82rem;
  border-radius: 10px;
  background: #2563eb;
  color: white;
  cursor: pointer;
  font-weight: 700;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(2, 6, 23, 0.75);
}

.modal-card {
  position: relative;
  width: min(980px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  padding: 1.25rem;
  border-radius: 22px;
  background: #eef4fb;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.25rem;
}

.modal-header {
  padding: 0.6rem 2rem 1rem 0;
}

.modal-header span {
  color: var(--primary);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.modal-header h2 {
  margin: 0.4rem 0;
  color: var(--text-strong);
}

.modal-header p {
  margin: 0;
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.detail-item {
  padding: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
}

.detail-item.full {
  grid-column: 1 / -1;
}

.detail-item span {
  display: block;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-item strong {
  display: block;
  margin-top: 0.35rem;
  color: var(--text-strong);
  line-height: 1.45;
}

@media (max-width: 900px) {
  .page-header,
  .filters-card {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
  }

  .stats-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
