<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { supabase } from '@/supabase'
import StatCard from '@/components/ui/StatCard.vue'

import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

/* =========================
   STATE
========================= */
const totalQuotes = ref(0)
const totalAirports = ref(0)
const recentQuotes = ref([])
const loading = ref(true)

/* FINANCIAL KPIs */
const totalRevenue = ref(0)
const monthlyRevenue = ref(0)
const averageTicket = ref(0)
const monthlyQuotes = ref(0)

/* CHART */
const revenueChart = ref(null)
let chartInstance = null

/* =========================
   FINANCIAL KPIs
========================= */
const calculateFinancialKPIs = async () => {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: allQuotes } = await supabase
    .from('quotes')
    .select('total_estimated_price, created_at')

  if (!allQuotes?.length) return []

  totalRevenue.value = allQuotes.reduce(
    (sum, q) => sum + (q.total_estimated_price || 0),
    0
  )

  const monthQuotes = allQuotes.filter(
    q => new Date(q.created_at) >= startOfMonth
  )

  monthlyQuotes.value = monthQuotes.length

  monthlyRevenue.value = monthQuotes.reduce(
    (sum, q) => sum + (q.total_estimated_price || 0),
    0
  )

  averageTicket.value = Math.round(
    totalRevenue.value / allQuotes.length
  )

  return allQuotes
}

/* =========================
   CHART
========================= */
const buildRevenueChart = async (quotes) => {

  await nextTick()

  if (!revenueChart.value) return

  const ctx = revenueChart.value.getContext("2d")

  const dailyMap = {}

  quotes.forEach(q => {
    if (!q.created_at || !q.total_estimated_price) return

    const day = new Date(q.created_at)
      .toISOString()
      .split('T')[0]

    dailyMap[day] = (dailyMap[day] || 0) + q.total_estimated_price
  })

  const labels = Object.keys(dailyMap).sort()
  const data = labels.map(d => dailyMap[d])

  if (chartInstance) chartInstance.destroy()

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          ticks: {
            callback: v => `$${v.toLocaleString()}`
          }
        }
      }
    }
  })
}

/* =========================
   MOUNT
========================= */
onMounted(async () => {

  try {

    loading.value = true

    const { count: qCount } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })

    const { count: aCount } = await supabase
      .from('aeropuertos_mexico')
      .select('*', { count: 'exact', head: true })

    const { data: lastQuotes } = await supabase
      .from('quotes')
      .select('id, full_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    totalQuotes.value = qCount || 0
    totalAirports.value = aCount || 0
    recentQuotes.value = lastQuotes || []

    const allQuotes = await calculateFinancialKPIs()

    await buildRevenueChart(allQuotes)

  } catch (err) {

    console.error("Dashboard error:", err)

  } finally {

    loading.value = false

  }

})
</script>

<template>
  <section class="dashboard">
    <!-- HEADER -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1>Dashboard</h1>
        <p>Resumen operativo del sistema</p>
      </div>
    </header>

    <!-- KPIs FINANCIEROS -->
    <section class="financial-kpis">
      <div class="kpi-card primary">
        <span class="label">Ingresos estimados</span>
        <strong>${{ totalRevenue.toLocaleString() }} USD</strong>
      </div>

      <div class="kpi-card">
        <span class="label">Ingresos del mes</span>
        <strong>${{ monthlyRevenue.toLocaleString() }} USD</strong>
      </div>

      <div class="kpi-card">
        <span class="label">Ticket promedio</span>
        <strong>${{ averageTicket.toLocaleString() }} USD</strong>
      </div>

      <div class="kpi-card muted">
        <span class="label">Cotizaciones este mes</span>
        <strong>{{ monthlyQuotes }}</strong>
      </div>
    </section>

    <!-- KPIs SIMPLES -->
    <div class="stats">
      <StatCard title="Cotizaciones totales" :value="totalQuotes" />
      <StatCard title="Aeropuertos activos" :value="totalAirports" />
    </div>

    <!-- GRID -->
    <div class="grid">
      <!-- ACTIVIDAD -->
      <section class="panel">
        <header class="panel-header">
          <h2>Actividad reciente</h2>
        </header>

        <div v-if="loading" class="state">Cargando actividad…</div>

        <ul v-else-if="recentQuotes.length" class="activity-list">
          <li v-for="q in recentQuotes" :key="q.id">
            <div class="activity-main">
              <strong>{{ q.full_name }}</strong>
              <span>{{ q.email }}</span>
            </div>
            <span class="activity-date">
              {{ new Date(q.created_at).toLocaleDateString() }}
            </span>
          </li>
        </ul>

        <div v-else class="state">Sin actividad reciente</div>
      </section>

      <!-- PLACEHOLDER -->
      <section class="panel muted">
        <h2>Próximamente</h2>
        <p>Gráficas, métricas y reportes ejecutivos</p>
      </section>
    </div>

    <!-- GRÁFICA -->
    <section class="panel">
      <header class="panel-header">
        <h2>Ingresos por día</h2>
      </header>

      <div class="chart-container">
        <canvas ref="revenueChart"></canvas>
      </div>
    </section>
  </section>
</template>
<style>
/* =========================
   CONTENEDOR
========================= */
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* =========================
   HEADER
========================= */
.dashboard-header {
  background: linear-gradient(
    135deg,
    var(--primary-dark),
    var(--primary-dark-2)
  );
  color: white;
  padding: 2rem;
  border-radius: 14px;
}

.header-left h1 {
  margin: 0;
  font-size: 1.8rem;
}

.header-left p {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* =========================
   KPIs SIMPLES
========================= */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

/* =========================
   GRID PRINCIPAL
========================= */
.grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

/* =========================
   PANEL
========================= */
.panel {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
  color: var(--text-main);
}

.panel-header {
  margin-bottom: 1rem;
}

.panel h2 {
  font-size: 1.05rem;
  margin: 0;
  color: var(--text-main);
}

/* =========================
   ACTIVIDAD RECIENTE
========================= */
.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.activity-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}

.activity-list li:last-child {
  border-bottom: none;
}

.activity-main {
  display: flex;
  flex-direction: column;
}

.activity-main strong {
  color: var(--text-main);
}

.activity-main span {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.activity-date {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* =========================
   ESTADOS
========================= */
.state {
  padding: 1rem 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
}

/* =========================
   MUTED PANEL
========================= */
.muted {
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: var(--text-muted);
}

/* =========================
   FINANCIAL KPIs
========================= */
.financial-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}

.kpi-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--text-main);
}

.kpi-card .label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kpi-card strong {
  font-size: 1.6rem;
  color: var(--text-main);
}

/* KPI PRINCIPAL */
.kpi-card.primary {
  background: linear-gradient(
    135deg,
    var(--primary-dark),
    var(--primary-dark-2)
  );
}

.kpi-card.primary .label {
  color: #cbd5e1;
}

.kpi-card.primary strong {
  color: white;
}

/* KPI MUTED */
.kpi-card.muted {
  background: var(--bg-muted);
}

/* =========================
   CHART
========================= */
.chart-container {
  height: 320px;
}


</style>
