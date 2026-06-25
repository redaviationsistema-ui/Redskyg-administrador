<script setup>
import { ref, watch, onMounted } from 'vue'
import { supabase } from '@/supabase'

/* =========================
   STATE
========================= */
const activeTab = ref('national') // national | international
const search = ref('')
const airports = ref([])
const loading = ref(false)

/* =========================
   FETCH AIRPORTS
========================= */
const fetchAirports = async () => {
  loading.value = true

  const table =
    activeTab.value === 'national'
      ? 'aeropuertos_mexico'
      : 'airports_geo'

  let query = supabase.from(table)

  /* === SELECT SEGÚN TAB === */
  if (activeTab.value === 'national') {
    query = query.select(`
      AEROPUERTO,
      CIUDAD,
      ESTADO,
      IATA,
      ICAO
    `)
  } else {
    query = query.select(`
      COUNTRY,
      CIUDAD,
      IATA,
      ICAO,
      AEROPUERTO
    `)
  }

  /* === BUSCADOR COMPLEJO === */
  if (search.value.trim()) {
    const s = search.value.trim()

    const filters =
      activeTab.value === 'national'
        ? `AEROPUERTO.ilike.%${s}%,CIUDAD.ilike.%${s}%,IATA.ilike.%${s}%,ICAO.ilike.%${s}%,ESTADO.ilike.%${s}%`
        : `AEROPUERTO.ilike.%${s}%,CIUDAD.ilike.%${s}%,IATA.ilike.%${s}%,ICAO.ilike.%${s}%,COUNTRY.ilike.%${s}%`

    query = query.or(filters)
  }

  /* === LIMIT === */
  query = query.limit(100)

  const { data, error } = await query

  if (!error) airports.value = data || []
  else console.error(error)

  loading.value = false
}

/* =========================
   WATCHERS
========================= */
watch([activeTab, search], fetchAirports)

/* =========================
   MOUNT
========================= */
onMounted(fetchAirports)
</script>


<template>
  <section class="page">
    <!-- HEADER -->
    <header class="page-header">
      <h1>Aeropuertos</h1>
      <p class="subtitle">
        Catálogo de aeropuertos nacionales e internacionales
      </p>
    </header>

    <!-- TABS -->
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'national' }]"
        @click="activeTab = 'national'"
      >
        🇲🇽 Nacional
      </button>

      <button
        :class="['tab', { active: activeTab === 'international' }]"
        @click="activeTab = 'international'"
      >
        🌍 Internacional
      </button>
    </div>

    <!-- SEARCH -->
    <div class="search-bar">
      <input
        v-model="search"
        type="text"
        placeholder="Buscar por aeropuerto, ciudad, IATA, ICAO o país…"
      />
    </div>

    <!-- STATE -->
    <div v-if="loading" class="state">
      Buscando aeropuertos…
    </div>

    <!-- TABLE -->
    <div v-else class="table-wrapper">
      <table class="table">
  <thead>
    <tr>
      <!-- COLUMNA DINÁMICA -->
      <th v-if="activeTab === 'national'">Estado</th>
      <th v-else>País</th>

      <th>Ciudad</th>
      <th>IATA</th>
      <th>ICAO</th>
    </tr>
  </thead>

  <tbody>
    <tr v-for="a in airports" :key="a.ID || a.IATA">
      <!-- VALOR DINÁMICO -->
      <td v-if="activeTab === 'national'">
        {{ a.ESTADO || '—' }}
      </td>
      <td v-else>
        {{ a.COUNTRY || '—' }}
      </td>

      <td>{{ a.CIUDAD }}</td>
      <td>{{ a.IATA }}</td>
      <td>{{ a.ICAO }}</td>
    </tr>
  </tbody>
</table>

    </div>
  </section>
</template>


<style>
/* =========================
   PAGE
========================= */
.page {
  width: 100%;
}

/* =========================
   HEADER
========================= */
.page-header {
  margin-bottom: 1.25rem;
}

.subtitle {
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* =========================
   TABS
========================= */
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab {
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-muted);
  transition: all 0.15s ease;
}

.tab.active {
  background: linear-gradient(
    135deg,
    var(--primary-dark),
    var(--primary-dark-2)
  );
  color: white;
  border-color: transparent;
}

/* =========================
   STATE
========================= */
.state {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

/* =========================
   TABLE
========================= */
.table-wrapper {
  overflow-x: auto;
}
/* =========================
   SEARCH
========================= */
.search-bar {
  margin: 1rem 0;
}

.search-bar input {
  width: 100%;
  max-width: 420px;
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  font-size: 0.85rem;
  color: var(--text-main);
}

.search-bar input::placeholder {
  color: var(--text-muted);
}

</style>
