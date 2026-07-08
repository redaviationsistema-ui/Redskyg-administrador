<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { supabase } from "@/supabase";

const scope = ref("national");
const aircraftOptions = ref([]);
const aircraftLoading = ref(false);

const selectedAircraftId = ref("");
const selectedFrom = ref(null);
const selectedTo = ref(null);

const fromQuery = ref("");
const toQuery = ref("");
const fromResults = ref([]);
const toResults = ref([]);
const fromLoading = ref(false);
const toLoading = ref(false);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function formatUsd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDuration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return "-";

  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours && minutes) {
    return `${wholeHours}h ${minutes}m`;
  }

  if (wholeHours) {
    return `${wholeHours}h`;
  }

  return `${minutes}m`;
}

function getOperationalExpense(aircraft) {
  const national = toNumber(aircraft?.national_expenses_usd) || 0;
  const international = toNumber(aircraft?.international_expenses_usd);

  if (scope.value === "international") {
    return international ?? national;
  }

  return national;
}

function getAirportCode(airport) {
  return airport?.iata || airport?.icao || "-";
}

function getAirportLocation(airport) {
  if (!airport) return "-";

  const region = scope.value === "national" ? airport.estado : airport.country;
  return [airport.ciudad, region].filter(Boolean).join(", ");
}

function normalizeAirportRecord(airport, currentScope) {
  return {
    aeropuerto:
      airport?.AEROPUERTO ||
      airport?.aeropuerto ||
      airport?.AIRPORT ||
      airport?.airport ||
      "-",
    ciudad: airport?.CIUDAD || airport?.ciudad || airport?.CITY || airport?.city || "",
    estado: airport?.ESTADO || airport?.estado || airport?.STATE || airport?.state || "",
    country: airport?.COUNTRY || airport?.country || "",
    iata: normalize(airport?.IATA || airport?.iata),
    icao: normalize(airport?.ICAO || airport?.icao),
    lat: toNumber(airport?.LATITUDE ?? airport?.latitude ?? airport?.lat),
    lng: toNumber(airport?.LONGITUDE ?? airport?.longitude ?? airport?.lng),
    scope: currentScope,
  };
}

function getMinHours(aircraft, distanceNm) {
  const configuredMinimum = toNumber(aircraft?.minimum_hours);

  if (configuredMinimum && configuredMinimum > 0) return configuredMinimum;

  const speed = toNumber(aircraft?.cruise_speed_knots) || 0;

  if (distanceNm < 150) return 0.6;
  if (distanceNm < 300) return 0.75;
  if (distanceNm < 500) return 1.0;
  if (speed < 200) return 1.5;
  if (speed < 300) return 1.25;
  if (speed < 450) return 1.0;
  if (speed < 600) return 1.25;
  return 1.5;
}

async function loadAircraft() {
  aircraftLoading.value = true;

  const { data, error } = await supabase
    .from("aircraft_fleet")
    .select(`
      id,
      name,
      aircraft_type,
      cruise_speed_knots,
      rental_price_usd,
      national_expenses_usd
    `)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Unable to load aircraft", error);
    aircraftOptions.value = [];
  } else {
    aircraftOptions.value = data || [];
  }

  aircraftLoading.value = false;
}

async function searchAirports(kind) {
  const query = kind === "from" ? fromQuery.value : toQuery.value;

  if (!query || query.trim().length < 2) {
    if (kind === "from") {
      fromResults.value = [];
    } else {
      toResults.value = [];
    }
    return;
  }

  if (kind === "from") {
    fromLoading.value = true;
  } else {
    toLoading.value = true;
  }

  const table = scope.value === "national" ? "aeropuertos_mexico" : "airports_geo";
  const request =
    scope.value === "national"
      ? supabase
          .from(table)
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
            `AEROPUERTO.ilike.%${query}%,CIUDAD.ilike.%${query}%,ESTADO.ilike.%${query}%,IATA.ilike.%${query}%,ICAO.ilike.%${query}%`,
          )
          .limit(8)
      : supabase
          .from(table)
          .select("*")
          .limit(50);

  const { data, error } = await request;

  if (error) {
    console.error(`Unable to load ${kind} airports`, error);
    if (kind === "from") {
      fromResults.value = [];
    } else {
      toResults.value = [];
    }
  }

  const normalizedResults = scope.value === "international"
    ? (data || [])
        .map((airport) => normalizeAirportRecord(airport, scope.value))
        .filter((airport) => {
          const haystack = [
            airport.aeropuerto,
            airport.ciudad,
            airport.country,
            airport.iata,
            airport.icao,
          ]
            .join(" ")
            .toUpperCase();

          return haystack.includes(normalize(query));
        })
        .slice(0, 8)
    : (data || []).map((airport) => normalizeAirportRecord(airport, scope.value));

  if (kind === "from") {
    fromResults.value = normalizedResults;
  } else {
    toResults.value = normalizedResults;
  }

  if (kind === "from") {
    fromLoading.value = false;
  } else {
    toLoading.value = false;
  }
}

function pickAirport(kind, airport) {
  if (kind === "from") {
    selectedFrom.value = airport;
    fromQuery.value = airport.iata || airport.icao || airport.aeropuerto || "";
    fromResults.value = [];
    return;
  }

  selectedTo.value = airport;
  toQuery.value = airport.iata || airport.icao || airport.aeropuerto || "";
  toResults.value = [];
}

function resetSelection() {
  selectedFrom.value = null;
  selectedTo.value = null;
  fromResults.value = [];
  toResults.value = [];
}

const selectedAircraft = computed(
  () => aircraftOptions.value.find((item) => String(item.id) === String(selectedAircraftId.value)) || null,
);

const distanceNm = computed(() => {
  if (!selectedFrom.value || !selectedTo.value) return null;

  const lat1 = toNumber(selectedFrom.value.lat);
  const lon1 = toNumber(selectedFrom.value.lng);
  const lat2 = toNumber(selectedTo.value.lat);
  const lon2 = toNumber(selectedTo.value.lng);

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  const radiusNm = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((radiusNm * c).toFixed(1));
});

const routeAnalysis = computed(() => {
  const aircraft = selectedAircraft.value;
  const distance = distanceNm.value;

  if (!aircraft || !distance) return null;

  const speedKnots = toNumber(aircraft.cruise_speed_knots);

  if (!speedKnots || speedKnots <= 0) {
    return {
      ready: false,
      reason: "La aeronave no tiene velocidad crucero configurada.",
    };
  }

  const cruiseHours = distance / speedKnots;
  const adjustedDistanceNm = distance * (scope.value === "international" ? 1.15 : 1.12);
  const blockBufferHours =
    adjustedDistanceNm < 300
      ? 0.25
      : adjustedDistanceNm < 600
        ? 0.35
        : adjustedDistanceNm < 1000
          ? 0.45
          : 0.5;
  const estimatedBlockHours = Math.ceil(((adjustedDistanceNm / speedKnots) + blockBufferHours) * 4) / 4;
  const minimumHours = getMinHours(aircraft, adjustedDistanceNm);
  const billableHours = Math.max(estimatedBlockHours, minimumHours);
  const hourlyRate = toNumber(aircraft.rental_price_usd) || 0;
  const operationalCost = getOperationalExpense(aircraft);
  const flightCost = Number((billableHours * hourlyRate).toFixed(2));

  return {
    ready: true,
    speedKnots,
    cruiseHours,
    adjustedDistanceNm,
    blockBufferHours,
    estimatedBlockHours,
    minimumHours,
    billableHours,
    hourlyRate,
    flightCost,
    operationalCost,
  };
});

watch(scope, () => {
  resetSelection();
  fromQuery.value = "";
  toQuery.value = "";
});

watch(fromQuery, () => {
  searchAirports("from");
});

watch(toQuery, () => {
  searchAirports("to");
});

onMounted(() => {
  loadAircraft();
});
</script>

<template>
  <section class="flight-time-page">
    <header class="hero">
      <div>
        <p class="eyebrow">Flight Time Tool</p>
        <h1>Tiempo estimado de vuelo por aeronave</h1>
        <p class="subtitle">
          Selecciona una aeronave, define origen y destino, y calcula distancia,
          tiempo crucero y tiempo estimado operativo.
        </p>
      </div>
    </header>

    <div class="workspace">
      <section class="control-card">
        <div class="control-head">
          <div>
            <h2>Configuración</h2>
            <p>Elige el tipo de operación y la aeronave con la que quieres estimar el trayecto.</p>
          </div>
          <div class="scope-toggle">
            <button :class="{ active: scope === 'national' }" @click="scope = 'national'">
              Nacional
            </button>
            <button :class="{ active: scope === 'international' }" @click="scope = 'international'">
              Internacional
            </button>
          </div>
        </div>

        <div class="field-grid">
          <label class="field">
            <span>Aeronave</span>
            <select v-model="selectedAircraftId">
              <option value="">
                {{ aircraftLoading ? "Cargando aeronaves..." : "Selecciona una aeronave" }}
              </option>
              <option
                v-for="aircraft in aircraftOptions"
                :key="aircraft.id"
                :value="aircraft.id"
              >
                {{ aircraft.name }} · {{ aircraft.aircraft_type || "Sin tipo" }} ·
                {{ aircraft.cruise_speed_knots || "-" }} kts
              </option>
            </select>
          </label>
        </div>

        <div v-if="selectedAircraft" class="aircraft-spotlight">
          <article>
            <span>Tipo</span>
            <strong>{{ selectedAircraft.aircraft_type || "-" }}</strong>
          </article>
          <article>
            <span>Velocidad crucero</span>
            <strong>{{ selectedAircraft.cruise_speed_knots || "-" }} kts</strong>
          </article>
          <article>
            <span>Tarifa por hora</span>
            <strong>{{ formatUsd(selectedAircraft.rental_price_usd) }}</strong>
          </article>
          <article>
            <span>Gasto operativo</span>
            <strong>
              {{
                formatUsd(
                  getOperationalExpense(selectedAircraft),
                )
              }}
            </strong>
          </article>
        </div>
      </section>

      <section class="picker-grid">
        <article class="picker-card">
          <div class="picker-head">
            <h3>Origen</h3>
            <p>Busca por aeropuerto, ciudad, IATA o ICAO.</p>
          </div>

          <input
            v-model="fromQuery"
            class="search-input"
            placeholder="Ej. TLC, Toluca, MMMX"
          />

          <div v-if="fromLoading" class="state-box">Buscando origen...</div>
          <div v-else-if="fromResults.length" class="result-list">
            <button
              v-for="airport in fromResults"
              :key="`${airport.icao || airport.iata}-${airport.aeropuerto}`"
              type="button"
              class="airport-row"
              @click="pickAirport('from', airport)"
            >
              <strong>{{ airport.aeropuerto }}</strong>
              <span>{{ getAirportLocation(airport) }}</span>
              <small>{{ getAirportCode(airport) }}</small>
            </button>
          </div>

          <div class="selection-box" :class="{ ready: selectedFrom }">
            <span>Seleccionado</span>
            <strong>{{ selectedFrom?.aeropuerto || "Sin origen" }}</strong>
            <small>{{ selectedFrom ? `${getAirportLocation(selectedFrom)} · ${getAirportCode(selectedFrom)}` : "Elige un aeropuerto de salida." }}</small>
          </div>
        </article>

        <article class="picker-card">
          <div class="picker-head">
            <h3>Destino</h3>
            <p>Usa el mismo criterio para el aeropuerto de llegada.</p>
          </div>

          <input
            v-model="toQuery"
            class="search-input"
            placeholder="Ej. MTY, Monterrey, MMMY"
          />

          <div v-if="toLoading" class="state-box">Buscando destino...</div>
          <div v-else-if="toResults.length" class="result-list">
            <button
              v-for="airport in toResults"
              :key="`${airport.icao || airport.iata}-${airport.aeropuerto}`"
              type="button"
              class="airport-row"
              @click="pickAirport('to', airport)"
            >
              <strong>{{ airport.aeropuerto }}</strong>
              <span>{{ getAirportLocation(airport) }}</span>
              <small>{{ getAirportCode(airport) }}</small>
            </button>
          </div>

          <div class="selection-box" :class="{ ready: selectedTo }">
            <span>Seleccionado</span>
            <strong>{{ selectedTo?.aeropuerto || "Sin destino" }}</strong>
            <small>{{ selectedTo ? `${getAirportLocation(selectedTo)} · ${getAirportCode(selectedTo)}` : "Elige un aeropuerto de llegada." }}</small>
          </div>
        </article>
      </section>

      <section class="result-card">
        <div class="result-head">
          <div>
            <h2>Resultado del trayecto</h2>
            <p>
              La estimación combina millas náuticas reales con velocidad crucero y un ajuste operativo.
            </p>
          </div>
        </div>

        <div v-if="!selectedAircraft || !selectedFrom || !selectedTo" class="empty-state">
          Selecciona una aeronave, origen y destino para ver el tiempo estimado de vuelo.
        </div>

        <div v-else-if="routeAnalysis && !routeAnalysis.ready" class="empty-state">
          {{ routeAnalysis.reason }}
        </div>

        <template v-else-if="routeAnalysis">
          <div class="kpi-grid">
            <article class="kpi primary">
              <span>Distancia</span>
              <strong>{{ distanceNm?.toFixed(1) }} NM</strong>
              <small>{{ getAirportCode(selectedFrom) }} → {{ getAirportCode(selectedTo) }}</small>
            </article>
            <article class="kpi">
              <span>Tiempo crucero</span>
              <strong>{{ formatDuration(routeAnalysis.cruiseHours) }}</strong>
              <small>{{ routeAnalysis.speedKnots }} kts</small>
            </article>
            <article class="kpi">
              <span>Tiempo estimado operativo</span>
              <strong>{{ formatDuration(routeAnalysis.estimatedBlockHours) }}</strong>
              <small>Con buffer operativo</small>
            </article>
            <article class="kpi">
              <span>Horas cobrables</span>
              <strong>{{ formatDuration(routeAnalysis.billableHours) }}</strong>
              <small>Mínimo aplicado: {{ routeAnalysis.minimumHours.toFixed(2) }} h</small>
            </article>
          </div>

          <div class="detail-grid">
            <article>
              <span>Distancia ajustada</span>
              <strong>{{ routeAnalysis.adjustedDistanceNm.toFixed(1) }} NM</strong>
            </article>
            <article>
              <span>Buffer operativo</span>
              <strong>{{ formatDuration(routeAnalysis.blockBufferHours) }}</strong>
            </article>
            <article>
              <span>Costo vuelo</span>
              <strong>{{ formatUsd(routeAnalysis.flightCost) }}</strong>
            </article>
            <article>
              <span>Gasto operativo</span>
              <strong>{{ formatUsd(routeAnalysis.operationalCost) }}</strong>
            </article>
          </div>
        </template>
      </section>
    </div>
  </section>
</template>

<style scoped>
.flight-time-page {
  display: flex;
  flex-direction: column;
  gap: 22px;
  color: #10233c;
}

.hero,
.control-card,
.picker-card,
.result-card {
  background:
    radial-gradient(circle at top right, rgba(50, 110, 191, 0.12), transparent 36%),
    linear-gradient(180deg, #ffffff 0%, #f5f8fc 100%);
  border: 1px solid #d9e4f2;
  border-radius: 28px;
  box-shadow: 0 20px 45px rgba(15, 35, 60, 0.08);
}

.hero {
  padding: 28px 30px;
}

.eyebrow {
  margin: 0 0 10px;
  color: #2a66b1;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero h1,
.control-head h2,
.result-head h2,
.picker-head h3 {
  margin: 0;
  color: #11233c;
}

.hero h1 {
  font-size: 34px;
  line-height: 1.05;
}

.subtitle,
.control-head p,
.result-head p,
.picker-head p {
  margin: 10px 0 0;
  color: #65778f;
}

.workspace {
  display: grid;
  gap: 22px;
}

.control-card,
.picker-card,
.result-card {
  padding: 24px;
}

.control-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.scope-toggle {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: #eaf1fb;
  padding: 5px;
  border-radius: 999px;
  gap: 6px;
}

.scope-toggle button {
  border: none;
  background: transparent;
  color: #47617f;
  padding: 10px 16px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
}

.scope-toggle button.active {
  background: linear-gradient(135deg, #1f5fa6 0%, #184884 100%);
  color: #fff;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  font-size: 12px;
  font-weight: 800;
  color: #5c708b;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.field select,
.search-input {
  width: 100%;
  border: 1px solid #cfdbeb;
  border-radius: 16px;
  padding: 14px 16px;
  background: #fff;
  color: #10233c;
  font: inherit;
  box-sizing: border-box;
}

.field select:focus,
.search-input:focus {
  outline: none;
  border-color: #2a66b1;
  box-shadow: 0 0 0 4px rgba(42, 102, 177, 0.12);
}

.aircraft-spotlight,
.kpi-grid,
.detail-grid,
.picker-grid {
  display: grid;
  gap: 14px;
}

.aircraft-spotlight {
  margin-top: 18px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.aircraft-spotlight article,
.detail-grid article {
  padding: 16px;
  border-radius: 18px;
  background: #f1f6fd;
  border: 1px solid #d8e4f2;
}

.aircraft-spotlight span,
.kpi span,
.detail-grid span,
.selection-box span {
  display: block;
  color: #6a7e97;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.aircraft-spotlight strong,
.detail-grid strong,
.selection-box strong {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  color: #11233c;
}

.picker-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.picker-card {
  min-width: 0;
}

.result-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.airport-row {
  border: 1px solid #d7e3f1;
  background: #fbfdff;
  border-radius: 16px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 4px;
}

.airport-row strong {
  color: #153459;
}

.airport-row span,
.airport-row small,
.selection-box small {
  color: #667991;
}

.airport-row:hover {
  border-color: #2a66b1;
  box-shadow: 0 10px 24px rgba(42, 102, 177, 0.12);
}

.selection-box,
.empty-state,
.state-box {
  margin-top: 16px;
  border-radius: 18px;
  padding: 18px;
  background: #f4f8fc;
  border: 1px solid #d9e4f2;
}

.selection-box.ready {
  background: linear-gradient(180deg, #eff6ff 0%, #eaf3ff 100%);
  border-color: #bfd4ee;
}

.result-head {
  margin-bottom: 18px;
}

.empty-state {
  color: #6a7e97;
}

.kpi-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.kpi {
  padding: 20px;
  border-radius: 22px;
  background: #f5f8fc;
  border: 1px solid #d8e4f2;
}

.kpi.primary {
  background: linear-gradient(135deg, #184884 0%, #1f5fa6 100%);
  border-color: transparent;
}

.kpi strong {
  display: block;
  margin-top: 10px;
  font-size: 28px;
  line-height: 1;
  color: #11233c;
}

.kpi small {
  display: block;
  margin-top: 10px;
  color: #6a7e97;
}

.kpi.primary span,
.kpi.primary strong,
.kpi.primary small {
  color: #fff;
}

.detail-grid {
  margin-top: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 1100px) {
  .picker-grid,
  .kpi-grid,
  .detail-grid,
  .aircraft-spotlight {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .hero,
  .control-card,
  .picker-card,
  .result-card {
    padding: 18px;
    border-radius: 22px;
  }

  .hero h1 {
    font-size: 28px;
  }

  .control-head {
    flex-direction: column;
  }

  .picker-grid,
  .kpi-grid,
  .detail-grid,
  .aircraft-spotlight {
    grid-template-columns: 1fr;
  }
}
</style>
