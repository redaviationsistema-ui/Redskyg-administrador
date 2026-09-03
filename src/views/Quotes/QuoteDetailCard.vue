<script setup>
import { computed, ref, watch } from "vue";
import { supabase } from "@/supabase";
import { generateFlightQuotePdf } from "@/utils/flightQuotePdf";
import {
  getPreferredAircraftName,
  resolveAircraftDisplayName,
} from "@/utils/aircraftDisplay";
import {
  getDisplayQuoteLegs,
  getDisplayRoutePath,
  getFinalQuoteRoute,
  getPrimaryQuoteRoute,
} from "@/utils/quoteRouteDisplay";
import { getLegMetricKey, getQuoteLegMetricsMap } from "@/utils/quoteLegMetrics";
import { buildQuoteCommercialBreakdownPresentation } from "@/utils/flightQuotePricing";
import { useFeedback } from "@/composables/useFeedback";

const props = defineProps({
  quote: {
    type: Object,
    default: null,
  },
});

const EMPTY_VALUE = "-";
const logoSrc = `${import.meta.env.BASE_URL}images/logoo.png`;
const feedback = useFeedback();

const termsSections = [
  {
    title: "USE OF PRIVATE AVIATION SERVICE",
    text: "The use of the aircraft is strictly limited to private transportation purposes, including family, business, and leisure travel. Any commercial or cargo activities of any kind are expressly prohibited.",
  },
  {
    title: "INCLUDED SERVICES",
    text: "The private jet includes airport fees, fuel, crew fees, a premium minibar, and snacks. This service must be requested in advance by the passenger to ensure proper delivery.",
  },
  {
    title: "CAPACITY AND LUGGAGE",
    text: "The maximum capacity of the aircraft is subject to the assigned aircraft. Each passenger is permitted standard luggage according to final flight confirmation.",
  },
  {
    title: "PAYMENT AND DEPOSIT",
    text: "The passenger must pay Red Sky Group a deposit of 50% of the total trip cost to secure the private aviation service. The remaining balance must be paid in full prior to boarding.",
  },
  {
    title: "ADDITIONAL DEPOSIT",
    text: "Depending on the destination, Red Sky Group may require a deposit greater than 50% to cover trip expenses such as fuel, handling, and overflight permits.",
  },
  {
    title: "PASSENGER AND COMPANIONS RESPONSIBILITY",
    text: "The passenger agrees to use and fly in the aircraft at their own risk and responsibility, as do their companions. The passenger and their companions confirm that they have medical insurance and will be responsible for any hospital expenses in the event of an accident at the airport ramp or FBO facilities.",
  },
  {
    title: "COMPLIANCE WITH SAFETY INSTRUCTIONS",
    text: "Passengers must comply at all times with all instructions and safety measures indicated by the Captain or First Officer. If crew instructions are not followed, Red Sky Group shall not be liable for any accidents occurring onboard the aircraft or airport facilities.",
  },
  {
    title: "PROHIBITIONS ONBOARD THE AIRCRAFT",
    text: "- Throwing sanitary paper or towels into the toilet.\n- Standing while the aircraft is taxiing, taking off, landing, or during turbulence.\n- Improper use of electronic or entertainment equipment.\n- Excessive alcohol consumption.\n- Possession or use of weapons, drugs, or illegal substances.",
  },
  {
    title: "TRANSPORT OF PROHIBITED ITEMS",
    text: "Transporting illegal substances, explosives, firearms, ammunition, or any items prohibited under the laws of Mexico or the United States is strictly forbidden. Transporting cash amounts exceeding legal limits without declaration is prohibited.",
  },
  {
    title: "DAMAGES AND ADDITIONAL COSTS",
    text: "- Damage to aircraft electronic or entertainment equipment.\n- Burns or irreparable stains on seats, flooring or carpets.\n- Malfunction of aircraft toilet due to improper use.\n- Loss or damage to onboard furniture or amenities.",
  },
  {
    title: "CANCELLATION POLICIES",
    text: "To cancel the private aviation service, the passenger must notify Red Sky Group at least 48 hours before the scheduled departure. Cancellations made less than 48 hours before departure may incur additional charges plus tax.",
  },
  {
    title: "DISCLAIMER OF LIABILITY",
    text: "Red Sky Group shall not be liable for illegal actions committed by the passenger or their companions. Passengers agree to indemnify and hold harmless Red Sky Group and its personnel from any legal claims resulting from such actions.",
  },
  {
    title: "COMPLIANCE WITH REGULATIONS",
    text: "Red Sky Group operates in strict compliance with aviation regulations in Mexico and the United States. Responsibility for compliance with laws related to transported goods or cash rests solely with the passenger.",
  },
  {
    title: "REFUSAL OF SERVICE",
    text: "Red Sky Group reserves the right to refuse boarding or terminate services if illegal activity is suspected. No refund will be provided in such cases.",
  },
  {
    title: "ACCEPTANCE OF TERMS AND CONDITIONS",
    text: "By booking and using the private jet of Red Sky Group, the passenger and their companions acknowledge and agree to comply with all terms and conditions set forth in this document.",
  },
];

const termsPageOne = computed(() => termsSections.slice(0, 10));
const termsPageTwo = computed(() => termsSections.slice(10));

const customerRoutes = computed(
  () => props.quote?.quote_routes || props.quote?.flight_quote_legs || [],
);
const routes = computed(() => getDisplayQuoteLegs(props.quote));
const firstRoute = computed(() => getPrimaryQuoteRoute(props.quote));
const lastRoute = computed(() => getFinalQuoteRoute(props.quote));
const routePath = computed(() => getDisplayRoutePath(props.quote));
const routeMetrics = ref({});
const resolvedAircraftName = ref(EMPTY_VALUE);
const reservationForm = ref({
  startDateTime: "",
  endDateTime: "",
});
const reservationBusy = ref(false);
const existingReservation = ref(null);
const pdfFileName = computed(() => {
  const origin = sanitizeFileSegment(firstRoute.value?.from_airport);
  const destination = sanitizeFileSegment(lastRoute.value?.to_airport);
  const aircraft = sanitizeFileSegment(
    resolvedAircraftName.value !== EMPTY_VALUE
      ? resolvedAircraftName.value
      : props.quote?.aircraft_name,
  );

  if (origin && destination && aircraft) {
    return `${origin}-${destination}-${aircraft}.pdf`;
  }

  if (origin && destination) {
    return `${origin}-${destination}.pdf`;
  }

  if (origin && aircraft) {
    return `${origin}-${aircraft}.pdf`;
  }

  if (destination && aircraft) {
    return `${destination}-${aircraft}.pdf`;
  }

  if (origin) {
    return `${origin}.pdf`;
  }

  if (destination) {
    return `${destination}.pdf`;
  }

  return `${String(props.quote?.id || "VUELO").toUpperCase()}.pdf`;
});

const commercialPresentation = computed(() =>
  buildQuoteCommercialBreakdownPresentation(props.quote, customerRoutes.value),
);
const totalPrice = computed(() => commercialPresentation.value.displayTotal);

const tripType = computed(() => props.quote?.flight_type || "Private Charter");

const clientRows = computed(() => [
  ["NAME", props.quote?.client_name || props.quote?.full_name || EMPTY_VALUE],
  ["EMAIL", props.quote?.client_email || props.quote?.email || EMPTY_VALUE],
  ["PHONE", props.quote?.client_phone || props.quote?.phone || EMPTY_VALUE],
]);

const profileRows = computed(() => {
  const passengerCount = Number(firstRoute.value?.passengers ?? props.quote?.passengers ?? 0);

  return [
    ["AIRCRAFT", resolvedAircraftName.value],
    ["ROUTE", routePath.value],
    ["TRIP TYPE", tripType.value],
    passengerCount > 0 ? ["PASSENGERS", passengerCount] : null,
  ].filter(Boolean);
});

const reservationAircraftId = computed(
  () =>
    firstRoute.value?.aircraft_id ||
    customerRoutes.value.find((route) => route?.aircraft_id)?.aircraft_id ||
    null,
);

const reservationButtonLabel = computed(() =>
  existingReservation.value?.id ? "Actualizar reserva" : "Marcar como reservado",
);

function getAirportDisplay(code, name) {
  const airportCode = String(code || "").trim().toUpperCase() || EMPTY_VALUE;
  const airportName = String(name || "").trim();
  const suffixMatch = airportName.match(/\s+(international\s+airport)$/i);
  const rawShortName = suffixMatch
    ? airportName.slice(0, suffixMatch.index).trim()
    : airportName;
  const shortName = (/^[A-ZÁÉÍÓÚÜÑ\s.'-]+$/.test(rawShortName)
    ? rawShortName.toLocaleLowerCase("es-MX").replace(/(^|[\s.'-])([a-záéíóúüñ])/g, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("es-MX")}`)
    : rawShortName
  ).replace(/^Licenciado\b/i, "Lic.");

  return {
    name: airportName ? `${shortName || airportCode} - ${airportCode}` : airportCode,
    detail: "",
  };
}

function formatDistanceLabel(value) {
  const label = String(value || "").trim();
  return label && label !== EMPTY_VALUE ? `${label.replace(/\s*NM$/i, "")} NM` : EMPTY_VALUE;
}

function formatTimeLabel(metrics) {
  const hours = Number(metrics?.durationHours);

  if (Number.isFinite(hours) && hours > 0) {
    const minutes = Math.round(hours * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  const label = String(metrics?.durationLabel || "").trim();
  const hourMatch = label.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  if (!hourMatch || (!hourMatch[1] && !hourMatch[2])) return EMPTY_VALUE;

  if (Number(hourMatch[1] || 0) === 0 && Number(hourMatch[2] || 0) === 0) {
    return EMPTY_VALUE;
  }

  return `${String(Number(hourMatch[1] || 0)).padStart(2, "0")}:${String(Number(hourMatch[2] || 0)).padStart(2, "0")}`;
}

const reservationSummary = computed(() => {
  if (!existingReservation.value?.id) {
    return "Completa la reserva operativa y guarda.";
  }

  return `Reservado con estatus ${existingReservation.value.status || "confirmed"}.`;
});

const estimatedReservationHours = computed(() => {
  const totalHours = routes.value.reduce((sum, route, index) => {
    const legHours = Number(getRouteMetrics(route, index)?.durationHours || 0);
    return sum + (Number.isFinite(legHours) ? legHours : 0);
  }, 0);

  if (totalHours <= 0) return 1;

  return Math.max(1, Math.ceil(totalHours * 4) / 4);
});

const canSaveReservation = computed(
  () =>
    Boolean(
      reservationAircraftId.value &&
        reservationForm.value.startDateTime &&
        reservationForm.value.endDateTime &&
        !reservationBusy.value,
    ),
);

const costRows = computed(() => commercialPresentation.value.displayRows);

function getAircraftName(route) {
  return getPreferredAircraftName(
    route?.aircraft_fleet?.name || props.quote?.aircraft_name,
    route?.aircraft_id || props.quote?.aircraft_id,
    EMPTY_VALUE,
  );
}

async function loadAircraftName() {
  const currentName = getAircraftName(firstRoute.value);

  if (currentName !== EMPTY_VALUE) {
    resolvedAircraftName.value = currentName;
    return;
  }

  resolvedAircraftName.value = await resolveAircraftDisplayName({
    aircraftId: firstRoute.value?.aircraft_id || props.quote?.aircraft_id,
    aircraftName: firstRoute.value?.aircraft_fleet?.name || props.quote?.aircraft_name,
    fallback: EMPTY_VALUE,
  });
}

function getRouteMetrics(route, index) {
  return routeMetrics.value[getLegMetricKey(route, index)] || null;
}

function formatDate(value) {
  if (!value) return EMPTY_VALUE;
  return new Date(value).toISOString().split("T")[0];
}

function formatCurrency(value) {
  return Number(value || 0).toFixed(2);
}

function toDateTimeLocalInput(value) {
  if (!value) return "";

  let parsed = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-").map(Number);
    parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  } else {
    parsed = new Date(value);
  }

  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (segment) => String(segment).padStart(2, "0");

  return [
    parsed.getUTCFullYear(),
    pad(parsed.getUTCMonth() + 1),
    pad(parsed.getUTCDate()),
  ].join("-") + `T${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}

function toIsoDateTime(value) {
  if (!value) return "";

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );

  if (!match) return "";

  const [, year, month, day, hour, minute] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0,
    ),
  ).toISOString();
}

function addHoursToLocalInput(value, hoursToAdd) {
  if (!value) return "";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  parsed.setMinutes(parsed.getMinutes() + Math.round(Number(hoursToAdd || 0) * 60));
  return toDateTimeLocalInput(parsed);
}

function sanitizeFileSegment(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function formatCostValue(row) {
  return `$${formatCurrency(row.displayValue)}`;
}

function getNightsBetween(startValue, endValue) {
  const startDate = normalizeDateOnly(startValue);
  const endDate = normalizeDateOnly(endValue);

  if (!startDate || !endDate || endDate <= startDate) {
    return 0;
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((endDate - startDate) / MS_PER_DAY);
}

function normalizeDateOnly(value) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

async function exportPDF() {
  if (!props.quote) return;

  const doc = await generateFlightQuotePdf(props.quote);
  doc.save(pdfFileName.value);
}

async function loadReservationState() {
  if (!props.quote?.id) {
    existingReservation.value = null;
    return;
  }

  const { data, error } = await supabase
    .from("reservations")
    .select("id, aircraft_id, start_datetime, end_datetime, status, quote_id")
    .eq("quote_id", props.quote.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Unable to load reservation state", error);
    existingReservation.value = null;
    return;
  }

  existingReservation.value = data || null;

  if (data) {
    reservationForm.value.startDateTime = toDateTimeLocalInput(data.start_datetime);
    reservationForm.value.endDateTime = toDateTimeLocalInput(data.end_datetime);
    return;
  }

  reservationForm.value.startDateTime = toDateTimeLocalInput(firstRoute.value?.start_date);
  reservationForm.value.endDateTime = toDateTimeLocalInput(lastRoute.value?.end_date);

  if (reservationForm.value.startDateTime && !reservationForm.value.endDateTime) {
    reservationForm.value.endDateTime = addHoursToLocalInput(
      reservationForm.value.startDateTime,
      estimatedReservationHours.value,
    );
  }
}

async function markAsReserved() {
  if (!props.quote?.id) return;

  const aircraftId = reservationAircraftId.value;
  const startISO = toIsoDateTime(reservationForm.value.startDateTime);
  const endISO = toIsoDateTime(reservationForm.value.endDateTime);

  if (!aircraftId) {
    feedback.warning("Aeronave faltante", "La cotizacion no tiene una aeronave asignada.");
    return;
  }

  if (!startISO || !endISO) {
    feedback.warning("Fechas incompletas", "Selecciona salida y regreso para reservar.");
    return;
  }

  if (new Date(startISO) >= new Date(endISO)) {
    feedback.warning(
      "Rango invalido",
      "La fecha de regreso debe ser posterior a la salida. Si termina despues de medianoche, selecciona el dia siguiente.",
    );
    return;
  }

  const result = await feedback.confirm({
    title: "Confirmar reserva",
    text: "Esta accion registrara el vuelo en reservations y bloqueara ese rango.",
    confirmButtonText: "Reservar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#166534",
  });

  if (!result.isConfirmed) return;

  reservationBusy.value = true;

  try {
    let overlapQuery = supabase
      .from("reservations")
      .select("id")
      .eq("aircraft_id", aircraftId)
      .lt("start_datetime", endISO)
      .gt("end_datetime", startISO);

    if (existingReservation.value?.id) {
      overlapQuery = overlapQuery.neq("id", existingReservation.value.id);
    }

    const { data: overlapping, error: overlapError } = await overlapQuery;

    if (overlapError) throw overlapError;

    if (overlapping?.length) {
      feedback.warning(
        "Rango ocupado",
        "Ya existe una reserva o bloqueo para esa aeronave en ese periodo.",
      );
      return;
    }

    const payload = {
      quote_id: props.quote.id,
      aircraft_id: aircraftId,
      start_datetime: startISO,
      end_datetime: endISO,
      status: "confirmed",
    };

    const reservationQuery = existingReservation.value?.id
      ? supabase
          .from("reservations")
          .update(payload)
          .eq("id", existingReservation.value.id)
      : supabase.from("reservations").insert(payload);

    const { error: saveError } = await reservationQuery;

    if (saveError) throw saveError;

    await loadReservationState();
    feedback.success("Reserva guardada", "El vuelo ya quedo registrado en reservations.");
  } catch (error) {
    console.error("Unable to save reservation", error);
    feedback.error("No se pudo guardar la reserva", error);
  } finally {
    reservationBusy.value = false;
  }
}

watch(
  routes,
  async (legs) => {
    routeMetrics.value = await getQuoteLegMetricsMap(legs || []);
    await loadAircraftName();
  },
  { immediate: true },
);

watch(
  () => [props.quote?.id, firstRoute.value?.start_date, lastRoute.value?.end_date],
  async () => {
    await loadReservationState();
  },
  { immediate: true },
);

watch(
  () => [reservationForm.value.startDateTime, estimatedReservationHours.value, existingReservation.value?.id],
  ([startDateTime, estimatedHours, reservationId]) => {
    if (reservationId || !startDateTime) return;

    const currentEnd = reservationForm.value.endDateTime;
    const startDate = new Date(startDateTime);
    const endDate = currentEnd ? new Date(currentEnd) : null;

    if (!currentEnd || !endDate || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      reservationForm.value.endDateTime = addHoursToLocalInput(
        startDateTime,
        estimatedHours,
      );
    }
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="quote" class="quote-card">
    <div class="actions">
      <div class="reservation-panel">
        <div class="reservation-copy">
          <strong>Reserva Operativa</strong>
          <span>{{ reservationSummary }}</span>
        </div>

        <label class="reservation-field">
          <span>Salida</span>
          <input v-model="reservationForm.startDateTime" type="datetime-local" />
        </label>

        <label class="reservation-field">
          <span>Regreso</span>
          <input v-model="reservationForm.endDateTime" type="datetime-local" />
        </label>

        <button
          class="btn-reserve"
          :disabled="!canSaveReservation"
          @click="markAsReserved"
        >
          {{ reservationBusy ? "Guardando..." : reservationButtonLabel }}
        </button>
      </div>

      <button class="btn-pdf" @click="exportPDF">Exportar PDF</button>
    </div>

    <div class="preview-root">
      <section class="pdf-page">
        <header class="topbar">
          <img :src="logoSrc" alt="Red Sky Group" class="logo" />

          <div class="meta-box">
            <div class="meta-row">
              <span>DATE</span>
              <strong>{{ formatDate(quote.created_at) }}</strong>
            </div>
            <div class="meta-row">
              <span>TYPE</span>
              <strong>Reservation</strong>
            </div>
          </div>
        </header>

        <section class="title-block">
          <h1>Executive Flight Quote</h1>
          <p>Professional private aviation quotation</p>
        </section>

        <div class="rule"></div>

        <section class="cards-grid">
          <article class="soft-card">
            <h3>Client Information</h3>
            <div class="field-list">
              <div v-for="[label, value] in clientRows" :key="label" class="field-item">
                <span>{{ label }}</span>
                <strong>{{ value }}</strong>
              </div>
            </div>
          </article>

          <article class="soft-card">
            <h3>Trip Profile</h3>
            <div class="field-list">
              <div v-for="[label, value] in profileRows" :key="label" class="field-item">
                <span>{{ label }}</span>
                <strong>{{ value }}</strong>
              </div>
            </div>
          </article>
        </section>

        <section class="block">
          <h2>Flight Legs</h2>

          <div class="table-shell">
            <div class="table-head">
              <span>#</span>
              <span>TIPO</span>
              <span>DEPARTURE</span>
              <span>ARRIVAL</span>
              <span>DIST (NM)</span>
              <span>TIME</span>
            </div>

            <div
              v-for="(route, index) in routes"
              :key="route.id || index"
              class="table-row"
              :class="{ 'table-row-positioning': route.positioning }"
            >
              <span class="leg-index-cell">
                <strong>{{ index + 1 }}</strong>
              </span>
              <span class="type-cell">
                <small
                  class="type-chip"
                  :class="route.positioning ? 'type-chip-positioning' : 'type-chip-client'"
                >
                  {{ route.positioning ? route.positioningLabel : "Tramo cliente" }}
                </small>
              </span>
              <span class="airport-cell">
                <strong>{{ getAirportDisplay(route.from_airport, route.from_airport_name).name }}</strong>
                <small>{{ getAirportDisplay(route.from_airport, route.from_airport_name).detail }}</small>
              </span>
              <span class="airport-cell">
                <strong>{{ getAirportDisplay(route.to_airport, route.to_airport_name).name }}</strong>
                <small>{{ getAirportDisplay(route.to_airport, route.to_airport_name).detail }}</small>
              </span>
              <span class="metric-cell">{{ formatDistanceLabel(getRouteMetrics(route, index)?.distanceLabel) }}</span>
              <span class="metric-cell">{{ formatTimeLabel(getRouteMetrics(route, index)) }}</span>
            </div>

            <div v-if="!routes.length" class="table-empty">
              No flight legs were registered for this quote.
            </div>
          </div>
        </section>

        <section class="block">
          <h2>Commercial Breakdown</h2>

          <div class="cost-shell">
            <div class="cost-head">
              <span>Description</span>
              <span>Amount</span>
            </div>

            <div v-for="row in costRows" :key="row.label" class="cost-row">
              <span>{{ row.label }}</span>
              <strong>{{ formatCostValue(row) }}</strong>
            </div>
          </div>
        </section>

        <section class="total-box">
          <span>TOTAL ESTIMATED BALANCE</span>
          <strong>${{ formatCurrency(totalPrice) }} USD</strong>
        </section>

        <footer class="footer">
          <span>Red Sky Group</span>
          <span>Page 1 of 3</span>
        </footer>
      </section>

      <section class="pdf-page pdf-break">
        <header class="terms-header">
          <h2>TERMS AND CONDITIONS</h2>
        </header>

        <section class="terms-flow">
          <article
            v-for="section in termsPageOne"
            :key="section.title"
            class="terms-section"
          >
            <h3>{{ section.title }}</h3>
            <p>{{ section.text }}</p>
          </article>
        </section>

        <footer class="footer">
          <span>Red Sky Group</span>
          <span>Page 2 of 3</span>
        </footer>
      </section>

      <section class="pdf-page pdf-break">
        <section class="terms-flow terms-flow-last">
          <article
            v-for="section in termsPageTwo"
            :key="section.title"
            class="terms-section"
          >
            <h3>{{ section.title }}</h3>
            <p>{{ section.text }}</p>
          </article>
        </section>

        <footer class="footer">
          <span>Red Sky Group</span>
          <span>Page 3 of 3</span>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.quote-card {
  --ink: #0f172a;
  --steel: #475569;
  --accent: #123456;
  --accent-soft: #e8eef5;
  --line: #d6dfe9;
  --panel: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.reservation-panel {
  display: flex;
  align-items: end;
  gap: 0.85rem;
  flex-wrap: wrap;
  padding: 0.85rem 1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: white;
}

.reservation-copy {
  display: flex;
  flex-direction: column;
  min-width: 260px;
  gap: 0.2rem;
}

.reservation-copy strong {
  font-size: 0.95rem;
}

.reservation-copy span {
  color: var(--steel);
  font-size: 0.82rem;
}

.reservation-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--steel);
  font-weight: 700;
}

.reservation-field input {
  min-width: 210px;
  padding: 0.58rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
  color: var(--ink);
  background: #fff;
}

.btn-reserve,
.btn-pdf {
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.btn-reserve {
  background: #166534;
}

.btn-reserve:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-pdf {
  background: #123456;
}

.btn-pdf,
.btn-reserve {
  align-self: center;
}

.preview-root {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pdf-page {
  position: relative;
  background: white;
  color: var(--ink);
  border-radius: 10px;
  padding: 2rem 2rem 3rem;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

.pdf-break {
  page-break-before: always;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.logo {
  width: 210px;
  max-width: 100%;
  object-fit: contain;
}

.meta-box {
  width: 190px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.55rem 0.75rem;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  font-size: 0.82rem;
}

.meta-row + .meta-row {
  margin-top: 0.6rem;
}

.meta-row span {
  color: var(--steel);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.title-block {
  margin-top: 1rem;
}

.title-block h1 {
  margin: 0;
  font-size: 1.9rem;
  line-height: 1.1;
}

.title-block p {
  margin: 0.3rem 0 0;
  color: var(--steel);
  font-size: 0.92rem;
}

.rule {
  height: 1px;
  margin-top: 0.95rem;
  background: var(--line);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.soft-card {
  background: var(--panel);
  border-radius: 8px;
  padding: 1rem;
}

.soft-card h3 {
  margin: 0 0 0.85rem;
  font-size: 1rem;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field-item span {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--steel);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.field-item strong {
  display: block;
  font-size: 0.95rem;
  line-height: 1.4;
}

.block {
  margin-top: 1.3rem;
}

.block h2,
.terms-header h2 {
  margin: 0 0 0.55rem;
  font-size: 1.05rem;
}

.table-shell {
  border-radius: 8px;
  overflow-x: auto;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 36px 150px minmax(0, 1fr) minmax(0, 1fr) 88px 72px;
  gap: 0.35rem;
  align-items: center;
  min-width: 800px;
  padding: 0.55rem 0.6rem;
  font-size: 0.84rem;
}

.table-head {
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.table-row {
  border-bottom: 1px solid var(--line);
  min-height: 56px;
}

.leg-index-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  font-weight: 700;
}

.type-cell {
  display: flex;
  align-items: center;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  padding: 0.24rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.type-chip-client {
  background: #e2e8f0;
  color: #334155;
}

.type-chip-positioning {
  background: #fef3c7;
  color: #9a3412;
}

.airport-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  line-height: 1.15;
}

.airport-cell strong {
  overflow-wrap: anywhere;
  font-size: 0.95rem;
  font-weight: 600;
}

.airport-cell > small:not(.positioning-chip) {
  margin-top: 0.18rem;
  color: #6b7280;
  font-size: 0.8rem;
}

.metric-cell,
.table-head span:nth-child(5),
.table-head span:nth-child(6) {
  text-align: center;
}

.table-row:nth-child(even) {
  background: var(--panel);
}

.table-row-positioning {
  background: rgba(251, 191, 36, 0.13);
}

.table-empty {
  padding: 0.9rem 0.8rem;
  color: var(--steel);
}

.cost-shell {
  background: var(--panel);
  border-radius: 8px;
  padding: 0.7rem 0.85rem 0.85rem;
}

.cost-head,
.cost-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
}

.cost-head {
  background: white;
  border-radius: 6px;
  padding: 0.5rem 0.7rem;
  color: var(--steel);
  font-size: 0.8rem;
  font-weight: 700;
}

.cost-row {
  padding: 0.75rem 0.15rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.9rem;
}

.cost-row:last-child {
  border-bottom: none;
  padding-bottom: 0.2rem;
}

.total-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 1.35rem;
  padding: 0.95rem 1.05rem;
  border-radius: 8px;
  background: var(--accent);
  color: white;
}

.total-box span {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.total-box strong {
  font-size: 1.5rem;
  line-height: 1;
}

.terms-header {
  margin-bottom: 1rem;
}

.terms-flow {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.terms-flow-last {
  margin-top: 0.4rem;
}

.terms-section {
  break-inside: avoid;
}

.terms-section h3 {
  margin: 0 0 0.35rem;
  font-size: 0.9rem;
}

.terms-section p {
  margin: 0;
  color: #1e293b;
  font-size: 0.88rem;
  line-height: 1.55;
  white-space: pre-line;
}

.footer {
  position: absolute;
  left: 2rem;
  right: 2rem;
  bottom: 1.1rem;
  display: flex;
  justify-content: space-between;
  padding-top: 0.45rem;
  border-top: 1px solid var(--line);
  color: var(--steel);
  font-size: 0.8rem;
}

@media (max-width: 900px) {
  .pdf-page {
    padding: 1.2rem 1.2rem 2.8rem;
  }

  .reservation-panel {
    width: 100%;
  }

  .topbar,
  .cards-grid,
  .total-box {
    display: block;
  }

  .meta-box,
  .soft-card + .soft-card,
  .total-box {
    margin-top: 1rem;
  }

  .footer {
    left: 1.2rem;
    right: 1.2rem;
  }
}

@media print {
  @page {
    size: A4;
    margin: 8mm;
  }

  .actions {
    display: none;
  }

  .pdf-page {
    box-shadow: none;
    border-radius: 0;
    padding: 0 0 2rem;
  }

  .pdf-page,
  .soft-card,
  .cost-shell,
  .total-box,
  .table-head {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
