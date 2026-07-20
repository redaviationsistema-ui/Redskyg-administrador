<script setup>
import { computed } from "vue";

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  summary: {
    type: Object,
    required: true,
  },
  source: {
    type: String,
    default: "local",
  },
});

function money(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: Math.abs(Number(value || 0)) >= 1000000 ? "compact" : "standard",
  }).format(Number(value || 0));
}

const kpis = computed(() => [
  {
    label: "Oportunidades",
    value: props.stats.total,
    hint: `${props.stats.open} activas en cotización`,
  },
  {
    label: "Pipeline",
    value: money(props.summary.activePipelineValue),
    hint: `${props.stats.negotiation} en negociación`,
  },
  {
    label: "Ingresos",
    value: money(props.summary.monthlyRevenue || props.stats.confirmedRevenue),
    hint: "Ventas confirmadas del mes",
  },
  {
    label: "Conversión",
    value: `${props.summary.conversionRate}%`,
    hint: `${props.stats.accepted + props.stats.sold} cierres efectivos`,
  },
  {
    label: "Seguimientos",
    value: props.summary.followUpToday,
    hint: "Acciones agendadas para hoy",
  },
]);

const stageBars = computed(() => {
  const stages = [
    { label: "Pendiente", value: props.stats.providerPending, tone: "amber" },
    { label: "Negociación", value: props.stats.negotiation, tone: "blue" },
    { label: "Ganadas", value: props.stats.accepted + props.stats.sold, tone: "green" },
    { label: "Perdidas", value: props.stats.lost, tone: "red" },
  ];
  const max = Math.max(...stages.map((stage) => stage.value), 1);

  return stages.map((stage) => ({
    ...stage,
    percent: `${Math.max(10, Math.round((stage.value / max) * 100))}%`,
  }));
});
</script>

<template>
  <section class="summary-shell">
    <div class="topline panel">
      <div class="topline-title">
        <strong>Pipeline Comercial</strong>
        <span>{{ stats.total }} oportunidades activas</span>
      </div>
      <div class="topline-metrics">
        <span>{{ money(summary.activePipelineValue) }} pipeline</span>
        <span>{{ summary.conversionRate }}% conversión</span>
        <span>{{ summary.followUpToday }} seguimientos</span>
      </div>
    </div>

    <div class="summary-grid">
      <article v-for="kpi in kpis" :key="kpi.label" class="kpi-card premium-card">
        <span class="kpi-label">{{ kpi.label }}</span>
        <strong class="kpi-value">{{ kpi.value }}</strong>
        <span class="kpi-hint">{{ kpi.hint }}</span>
      </article>
    </div>

    <div class="insights-grid">
      <section class="chart-card premium-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Visión rápida</p>
            <h3>Pipeline por estado</h3>
          </div>
          <span class="source-pill">{{ source === "supabase" ? "Supabase" : "Respaldo local" }}</span>
        </div>

        <div class="stage-bars">
          <div v-for="stage in stageBars" :key="stage.label" class="stage-row">
            <div class="stage-copy">
              <strong>{{ stage.label }}</strong>
              <span>{{ stage.value }}</span>
            </div>
            <div class="stage-track">
              <div class="stage-fill" :class="`tone-${stage.tone}`" :style="{ width: stage.percent }"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="funnel-card premium-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Embudo</p>
            <h3>Recorrido comercial</h3>
          </div>
        </div>

        <div class="funnel-list">
          <div class="funnel-step">
            <strong>{{ stats.total }}</strong>
            <span>Leads / oportunidades</span>
          </div>
          <div class="funnel-arrow">↓</div>
          <div class="funnel-step">
            <strong>{{ stats.open + stats.providerPending }}</strong>
            <span>Cotizaciones activas</span>
          </div>
          <div class="funnel-arrow">↓</div>
          <div class="funnel-step">
            <strong>{{ stats.negotiation }}</strong>
            <span>Negociaciones</span>
          </div>
          <div class="funnel-arrow">↓</div>
          <div class="funnel-step accent">
            <strong>{{ stats.accepted + stats.sold }}</strong>
            <span>Ventas cerradas</span>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.summary-shell {
  display: grid;
  gap: 16px;
}

.premium-card {
  border: 1px solid var(--border-color);
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(15, 95, 166, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 248, 252, 0.96));
  box-shadow: var(--shadow-sm);
}

.topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 20px;
}

.topline-title,
.topline-metrics {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.topline-title strong {
  font-size: 1rem;
  color: var(--text-strong);
}

.topline-title span,
.topline-metrics span {
  color: var(--text-muted);
  font-weight: 700;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.kpi-card {
  display: grid;
  gap: 8px;
  padding: 18px;
}

.kpi-label {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.kpi-value {
  font-size: 2rem;
  line-height: 1;
  color: var(--text-strong);
}

.kpi-hint {
  color: var(--text-muted);
  font-size: 0.86rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);
  gap: 16px;
}

.chart-card,
.funnel-card {
  padding: 18px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary);
}

.section-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.source-pill {
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(15, 95, 166, 0.08);
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 800;
}

.stage-bars {
  display: grid;
  gap: 14px;
}

.stage-row {
  display: grid;
  gap: 8px;
}

.stage-copy {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-main);
}

.stage-track {
  height: 12px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  overflow: hidden;
}

.stage-fill {
  height: 100%;
  border-radius: inherit;
}

.tone-amber {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.tone-blue {
  background: linear-gradient(90deg, #0f5fa6, #2563eb);
}

.tone-green {
  background: linear-gradient(90deg, #15803d, #22c55e);
}

.tone-red {
  background: linear-gradient(90deg, #dc2626, #ef4444);
}

.funnel-list {
  display: grid;
  gap: 8px;
}

.funnel-step {
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--bg-soft);
}

.funnel-step strong {
  display: block;
  font-size: 1.4rem;
  color: var(--text-strong);
}

.funnel-step span {
  color: var(--text-muted);
  font-weight: 700;
}

.funnel-step.accent {
  background: rgba(22, 163, 74, 0.1);
}

.funnel-arrow {
  text-align: center;
  color: var(--text-faint);
  font-weight: 900;
}

@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .insights-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .topline {
    flex-direction: column;
    align-items: start;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
