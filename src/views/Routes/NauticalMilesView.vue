<script setup>
import { ref, watch } from 'vue'
import { supabase } from '@/supabase'

const scope = ref('national') // national | international
const search = ref('')
const airports = ref([])
const loading = ref(false)

const selectedFrom = ref(null)
const selectedTo = ref(null)
const distanceNM = ref(null)

/* =========================
   FETCH AIRPORTS
========================= */
const fetchAirports = async () => {
  if (!search.value || search.value.length < 2) {
    airports.value = []
    return
  }

  loading.value = true

  let query

  if (scope.value === 'national') {
    query = supabase
      .from('aeropuertos_mexico')
      .select(`
        AEROPUERTO,
        CIUDAD,
        ESTADO,
        IATA,
        ICAO,
        LATITUDE,
        LONGITUDE
      `)
      .or(
        `CIUDAD.ilike.%${search.value}%,ESTADO.ilike.%${search.value}%,IATA.ilike.%${search.value}%,ICAO.ilike.%${search.value}%`
      )
      .limit(20)
  } else {
    query = supabase
      .from('airports_geo')
      .select(`
        AEROPUERTO,
        CIUDAD,
        COUNTRY,
        IATA,
        ICAO,
        LATITUDE,
        LONGITUDE
      `)
      .or(
        `CIUDAD.ilike.%${search.value}%,COUNTRY.ilike.%${search.value}%,IATA.ilike.%${search.value}%,ICAO.ilike.%${search.value}%`
      )
      .limit(20)
  }

  const { data, error } = await query

  if (error) {
    console.error('Supabase error:', error)
    airports.value = []
  } else {
    airports.value = data || []
  }

  loading.value = false
}

/* =========================
   WATCH SEARCH
========================= */
watch([search, scope], fetchAirports)

/* =========================
   DISTANCE (HAVERSINE)
========================= */
const toRad = d => d * Math.PI / 180

const calculateDistance = () => {
  if (!selectedFrom.value || !selectedTo.value) return

  const R = 3440.065 // millas náuticas

  const lat1 = selectedFrom.value.LATITUDE
  const lon1 = selectedFrom.value.LONGITUDE
  const lat2 = selectedTo.value.LATITUDE
  const lon2 = selectedTo.value.LONGITUDE

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  distanceNM.value = Math.round(R * c)
}
</script>

<template>
  <section class="page">
    <h1>✈️ Cálculo de Millas Náuticas</h1>
    <p class="subtitle">
      Herramienta operativa para cálculo real de distancia aérea
    </p>

    <!-- TIPO -->
    <div class="toggle">
      <button
        :class="{ active: scope === 'national' }"
        @click="scope = 'national'"
      >
        Nacional
      </button>
      <button
        :class="{ active: scope === 'international' }"
        @click="scope = 'international'"
      >
        Internacional
      </button>
    </div>

    <!-- SEARCH -->
    <input
      class="search"
      v-model="search"
      placeholder="Buscar por estado, ciudad, IATA o ICAO"
    />

    <!-- RESULTS -->
    <div v-if="loading" class="state">Buscando aeropuertos…</div>

   
    <table v-else class="table" v-if="airports.length">
  <thead>
    <tr>
      <th v-if="scope === 'international'">País</th>
      <th v-if="scope === 'national'">Estado</th>
      <th>Aeropuerto</th>
      <th>Ciudad</th>
      <th>IATA</th>
      <th>ICAO</th>
      <th></th>
    </tr>
  </thead>

  <tbody>
    <tr v-for="a in airports" :key="a.ICAO">
      <td v-if="scope === 'international'">{{ a.COUNTRY }}</td>
      <td v-if="scope === 'national'">{{ a.ESTADO }}</td>

      <td class="airport-name">
        {{ a.AEROPUERTO }}
      </td>

      <td>{{ a.CIUDAD }}</td>
      <td>{{ a.IATA }}</td>
      <td>{{ a.ICAO }}</td>

      <td class="actions">
        <button @click="selectedFrom = a">Origen</button>
        <button @click="selectedTo = a">Destino</button>
      </td>
    </tr>
  </tbody>
</table>

    <!-- SELECTED -->
    <div class="selected">
      <div>
        <strong>Origen:</strong>
        {{ selectedFrom?.AEROPUERTO || '—' }}
      </div>
      <div>
        <strong>Destino:</strong>
        {{ selectedTo?.AEROPUERTO || '—' }}
      </div>
    </div>

    <button
      class="calculate"
      :disabled="!selectedFrom || !selectedTo"
      @click="calculateDistance"
    >
      Calcular millas náuticas
    </button>

    <!-- RESULT -->
    <div v-if="distanceNM" class="result">
      ✈️ Distancia: <strong>{{ distanceNM }} NM</strong>
    </div>
  </section>
</template>

<style scoped>
/* =========================
   CONTENEDOR PRINCIPAL
========================= */
.nm-card {
  background: var(--bg-card);
  border-radius: 18px;
  padding: 2rem;
  max-width: 1200px;
  box-shadow: 0 20px 40px rgba(0,0,0,.08);
}

/* =========================
   HEADER
========================= */
.nm-header {
  margin-bottom: 1.75rem;
}

.nm-header h1 {
  font-size: 1.6rem;
  margin: 0;
}

.nm-header p {
  margin-top: 0.35rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* =========================
   TOGGLE NACIONAL / INTL
========================= */
.toggle {
  display: inline-flex;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  /* overflow: hidden; */
  margin-bottom: 1.25rem;
}

.toggle button {
  padding: 0.5rem 1.25rem;
  background: transparent;
  border: none;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text-muted);
}

.toggle button.active {
  background: var(--primary-dark);
  color: white;
}

/* =========================
   SEARCH
========================= */
.search {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

/* =========================
   TABLE
========================= */
.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-card);
  border-radius: 14px;
  /* overflow: hidden; */
  margin-bottom: 1.5rem;
}

.table th {
  background: var(--bg-muted);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0.65rem;
}

.table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

.table tbody tr:hover {
  background: var(--bg-hover);
}

.airport-name {
  font-weight: 600;
}

/* =========================
   ACTION BUTTONS
========================= */
.actions button {
  font-size: 0.7rem;
  padding: 0.3rem 0.55rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: #2563eb;
  color: white;
}

.actions button:last-child {
  background: #0f172a;
}

/* =========================
   SELECTED ORIGIN / DEST
========================= */
.selected {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
  margin: 1.75rem 0;
}

.selected > div {
  background: var(--bg-muted);
  border-radius: 14px;
  padding: 1rem;
}

.selected strong {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.selected div::after {
  content: attr(data-code);
}

/* =========================
   CALCULATE BUTTON
========================= */
.calculate {
  display: inline-block;
  background: linear-gradient(
    135deg,
    #2563eb,
    #1e3a8a
  );
  color: white;
  border: none;
  padding: 0.7rem 1.6rem;
  border-radius: 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

/* =========================
   RESULT KPI
========================= */
.result {
  margin-top: 1.5rem;
  background: linear-gradient(
    135deg,
    var(--primary-dark),
    var(--primary-dark-2)
  );
  color: white;
  padding: 1.5rem;
  border-radius: 16px;
  font-size: 1.4rem;
  font-weight: 600;
  text-align: center;
}

</style>
