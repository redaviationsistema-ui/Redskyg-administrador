<script setup>
import CommercialActions from "./CommercialActions.vue";
import CommercialStatus from "./CommercialStatus.vue";

const props = defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  loading: Boolean,
  error: {
    type: String,
    default: "",
  },
  activeId: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "select",
  "view",
  "edit",
  "duplicate",
  "email",
  "pdf",
  "status-change",
  "follow-up",
  "note",
  "attachment",
  "delete",
  "retry",
]);

function formatCurrency(value, currency) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function initials(row) {
  return String(row.customerName || "CC")
    .split(" ")
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase())
    .join("");
}

function priorityMeta(row) {
  if (row.status === "aceptada" || row.status === "vuelo vendido") {
    return { label: "✈ Vuelo confirmado", tone: "green" };
  }
  if (row.status === "pendiente proveedor") {
    return { label: "⚠ Pendiente proveedor", tone: "amber" };
  }
  if (row.status === "perdida") {
    return { label: "🔴 Perdida", tone: "red" };
  }
  if (Number(row.margin || 0) >= 20) {
    return { label: "🔥 Cliente caliente", tone: "orange" };
  }
  return { label: "🔵 Cotizando", tone: "blue" };
}

function progressValue(row) {
  const map = {
    abierta: 0,
    pendiente: 0,
    contactado: 10,
    cotizando: 20,
    cotizado: 30,
    "solicitada proveedor": 40,
    "pendiente proveedor": 40,
    "enviada cliente": 50,
    "en negociacion": 60,
    aceptada: 70,
    "vuelo vendido": 80,
    ganada: 90,
    facturada: 95,
    pagada: 100,
    "no aceptada": 0,
    perdida: 0,
    cancelada: 0,
  };
  return map[row.status] || 20;
}

function stageLabel(row) {
  const map = {
    abierta: "Solicitud",
    pendiente: "Pendiente",
    contactado: "Contacto",
    cotizando: "Cotizando",
    cotizado: "Cotizado",
    "solicitada proveedor": "Proveedor",
    "pendiente proveedor": "Proveedor",
    "enviada cliente": "Cliente",
    "en negociacion": "Negociacion",
    aceptada: "Contrato",
    "vuelo vendido": "Vuelo",
    ganada: "Ganada",
    facturada: "Facturada",
    pagada: "Pagada",
    "no aceptada": "No aceptada",
    perdida: "Perdida",
    cancelada: "Cancelada",
  };
  return map[row.status] || "Solicitud";
}

function isUpcoming(date) {
  return Boolean(date) && date >= "2026-07-20";
}
</script>

<template>
  <section class="workspace-shell panel">
    <div class="workspace-head">
      <div>
        <h3>Workspace comercial</h3>
        <p>Selecciona una oportunidad para ver el resumen, actividad y próximos pasos.</p>
      </div>
      <strong>{{ rows.length }} oportunidades</strong>
    </div>

    <div v-if="error" class="error-state">
      <p class="error">{{ error }}</p>
      <button type="button" class="retry-button" @click="emit('retry')">Reintentar</button>
    </div>
    <p v-else-if="loading" class="placeholder">Cargando oportunidades...</p>
    <p v-else-if="!rows.length" class="placeholder">No hay oportunidades que coincidan con tus filtros.</p>

    <div v-else class="rows-list">
      <article
        v-for="row in rows"
        :key="row.id"
        class="row-card"
        :class="{ active: row.id === activeId }"
        @click="emit('select', row)"
      >
        <div class="row-main">
          <div class="avatar">{{ initials(row) }}</div>

          <div class="identity">
            <div class="identity-top">
              <strong>{{ row.folio }}</strong>
              <span class="meta-chip">{{ row.companyName || "Cuenta directa" }}</span>
              <span class="priority-pill" :class="`tone-${priorityMeta(row).tone}`">{{ priorityMeta(row).label }}</span>
            </div>

            <div class="identity-copy">
              <h4>{{ row.customerName }}</h4>
              <p>{{ row.route }} · {{ row.aircraft || "Aeronave por asignar" }}</p>
            </div>
          </div>
        </div>

        <div class="row-middle">
          <div class="metric-block">
            <span>Proveedor</span>
            <strong>{{ row.provider || "Por definir" }}</strong>
          </div>
          <div class="metric-block">
            <span>Venta</span>
            <strong>{{ formatCurrency(row.salePrice || row.potentialRevenue, row.currency) }}</strong>
          </div>
          <div class="metric-block">
            <span>Seguimiento</span>
            <strong :class="{ due: !isUpcoming(row.nextFollowUp) }">{{ row.nextFollowUp || "Pendiente" }}</strong>
          </div>
        </div>

        <div class="row-progress">
          <div class="progress-copy">
            <span>{{ stageLabel(row) }}</span>
            <strong>{{ progressValue(row) }}%</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progressValue(row)}%` }"></div>
          </div>
          <CommercialStatus :status="row.status" :options="[]" />
        </div>

        <div class="row-actions" @click.stop>
          <CommercialActions
            :row="row"
            @view="emit('view', $event)"
            @edit="emit('edit', $event)"
            @duplicate="emit('duplicate', $event)"
            @email="emit('email', $event)"
            @pdf="emit('pdf', $event)"
            @follow-up="emit('follow-up', $event)"
            @note="emit('note', $event)"
            @attachment="emit('attachment', $event)"
            @delete="emit('delete', $event)"
          />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.workspace-shell {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
}

.workspace-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: start;
}

.workspace-head h3 {
  margin: 0 0 4px;
  color: var(--text-strong);
}

.workspace-head p {
  margin: 0;
  color: var(--text-muted);
}

.rows-list {
  display: grid;
  gap: 12px;
}

.row-card {
  display: grid;
  grid-template-columns: minmax(280px, 1.35fr) minmax(240px, 0.85fr) minmax(220px, 0.75fr);
  gap: 18px;
  align-items: center;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.row-card:hover,
.row-card.active {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
  border-color: rgba(15, 95, 166, 0.28);
}

.row-main {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.avatar {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, #0f5fa6 0%, #17385e 100%);
  color: white;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.identity {
  display: grid;
  gap: 8px;
}

.identity-top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.identity-top strong {
  color: var(--text-strong);
}

.meta-chip,
.priority-pill {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
}

.meta-chip {
  background: var(--bg-soft);
  color: var(--text-muted);
}

.priority-pill.tone-green {
  background: rgba(22, 163, 74, 0.12);
  color: #166534;
}

.priority-pill.tone-amber {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.priority-pill.tone-orange {
  background: rgba(249, 115, 22, 0.14);
  color: #c2410c;
}

.priority-pill.tone-red {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.priority-pill.tone-blue {
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.identity-copy h4 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1rem;
}

.identity-copy p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.row-middle {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-block {
  display: grid;
  gap: 4px;
}

.metric-block span {
  color: var(--text-faint);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.metric-block strong {
  color: var(--text-strong);
}

.metric-block strong.due {
  color: var(--danger);
}

.row-progress {
  display: grid;
  gap: 10px;
}

.progress-copy {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-weight: 700;
  color: var(--text-main);
}

.progress-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0f5fa6, #2563eb);
}

.row-actions {
  grid-column: 1 / -1;
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: opacity 0.18s ease, max-height 0.18s ease;
}

.row-card:hover .row-actions,
.row-card.active .row-actions {
  opacity: 1;
  max-height: 120px;
}

.placeholder,
.error {
  margin: 0;
  padding: 18px;
  border-radius: 18px;
  background: var(--bg-soft);
}

.error {
  color: var(--danger);
}

@media (max-width: 1200px) {
  .row-card {
    grid-template-columns: 1fr;
  }

  .row-middle {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .row-actions {
    opacity: 1;
    max-height: none;
  }
}

@media (max-width: 700px) {
  .row-middle {
    grid-template-columns: 1fr;
  }
}
</style>
