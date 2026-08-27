<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { jsPDF } from "jspdf";
import { supabase } from "@/supabase";
import { useFeedback } from "@/composables/useFeedback";

const router = useRouter();
const route = useRoute();
const feedback = useFeedback();

const loading = ref(false);
const saving = ref(false);
const editingQuoteId = ref(route.query.edit === "true" ? route.query.quote_id || null : null);
const editingQuoteNumber = ref("");
const DEFAULT_CLIENT_NAME = "A QUIEN CORRESPONDA";

const form = ref({
  full_name: DEFAULT_CLIENT_NAME,
  flight_type: "Private Jet",
  quote_mode: "complete",
  time_mode: "block",
  departure_at: "",
  return_at: "",
});

const aircraftFleet = ref([]);
const allAirports = ref([]);
const routeItems = ref([emptyRoute()]);
const quotePreview = ref(null);
const savedQuote = ref(null);
const DEFAULT_EXCHANGE_RATE = 17.42;
const isEditMode = computed(() => Boolean(editingQuoteId.value));

function emptyRoute() {
  return {
    from_airport: "",
    to_airport: "",
    passengers: "",
  };
}

function normalizePassengerCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalize(value) {
  return String(value || "").trim().toUpperCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAirportOptionValue(airport) {
  return String(airport?.iata || airport?.IATA || airport?.aeropuerto || "")
    .trim()
    .toUpperCase();
}

function toIsoOrNull(value) {
  if (!value) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (match) {
    const [, year, month, day, hours, minutes, seconds = "00"] = match;
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (part) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toDateTimeLocalInput(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part) => String(part).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function generateQuoteNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const timePart = String(now.getTime()).slice(-5);
  return `FQ-${datePart}-${timePart}`;
}

const airportOptions = computed(() => {
  const seen = new Set();

  return allAirports.value.filter((airport) => {
    const code = normalize(getAirportOptionValue(airport));
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
});

const selectedAircraft = computed(() =>
  aircraftFleet.value.find(
    (aircraft) => String(aircraft.id) === String(routeItems.value[0]?.aircraft_id || selectedAircraftId.value),
  ) || null,
);

const selectedAircraftId = computed(() => routeItems.value[0]?.aircraft_id || "");

const flightTypeOptions = [
  "Private Jet",
  "Helicopter",
  "Air Ambulance",
  "Cargo",
];

const filteredFleet = computed(() => {
  const map = {
    "Private Jet": "Jet Ejecutivo",
    Helicopter: "Helicóptero",
    "Air Ambulance": "Jet Ejecutivo",
    Cargo: "Turbohélice",
  };

  const selectedType = "";

  if (!selectedType) return aircraftFleet.value;

  return aircraftFleet.value.filter(
    (aircraft) => normalize(aircraft.aircraft_type) === normalize(selectedType),
  );
});

function getAircraftById(id) {
  return aircraftFleet.value.find(
    (aircraft) => String(aircraft.id) === String(id),
  ) || null;
}

function getRouteAircraftId(routeItem) {
  return routeItem?.aircraft_id || selectedAircraftId.value || null;
}

function findAirport(code) {
  const normalizedCode = normalize(code);

  return (
    allAirports.value.find(
      (airport) =>
        normalize(getAirportOptionValue(airport)) === normalizedCode ||
        normalize(airport.aeropuerto) === normalizedCode,
    ) || null
  );
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function getDistanceNM(lat1, lon1, lat2, lon2) {
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1.852;
}

function getAircraftCruiseSpeed(aircraft) {
  return toNumber(
    aircraft?.cruise_speed_knots ??
      aircraft?.cruiseSpeedKnots ??
      aircraft?.cruise_speed ??
      aircraft?.speed_knots ??
      aircraft?.speed,
  );
}

function getAircraftRentalRate(aircraft) {
  return toNumber(
    aircraft?.rental_price_usd ??
      aircraft?.rentalPriceUsd ??
      aircraft?.precio_renta_usd,
  );
}

function getMinHours(aircraft, distanceNm) {
  const configuredMinimum = toNumber(
    aircraft?.minimum_hours ?? aircraft?.minimumHours,
    0,
  );

  if (configuredMinimum > 0) return configuredMinimum;

  const speed = getAircraftCruiseSpeed(aircraft);

  if (distanceNm < 150) return 0.6;
  if (distanceNm < 300) return 0.75;
  if (distanceNm < 500) return 1.0;
  if (speed < 200) return 1.5;
  if (speed < 300) return 1.25;
  if (speed < 450) return 1.0;
  if (speed < 600) return 1.25;
  return 1.5;
}

function getNightsBetween(departureAt, returnAt) {
  if (!departureAt || !returnAt) return 0;

  const start = new Date(departureAt);
  const end = new Date(returnAt);
  return Math.max(0, (end - start) / 86400000);
}

function getRouteNights() {
  return getNightsBetween(form.value.departure_at, form.value.return_at);
}

const isInternationalFlight = computed(() =>
  validRoutes.value.some((routeItem) => {
    const from = findAirport(routeItem.from_airport);
    const to = findAirport(routeItem.to_airport);

    if (!from || !to) return false;

    return normalize(from.country) !== normalize(to.country);
  }),
);

function getAircraftBaseAirport(aircraftId) {
  const aircraft = getAircraftById(aircraftId);
  if (!aircraft?.home_base) return null;

  const iata = normalize(aircraft.iata || aircraft.home_base);

  return (
    allAirports.value.find(
      (airport) => normalize(getAirportOptionValue(airport)) === iata,
    ) || null
  );
}

function isSameAirportLocation(leftAirport, rightAirport) {
  if (!leftAirport || !rightAirport) return false;

  const sameCode =
    normalize(getAirportOptionValue(leftAirport)) ===
    normalize(getAirportOptionValue(rightAirport));
  const sameName = normalize(leftAirport.aeropuerto) === normalize(rightAirport.aeropuerto);
  const sameCity = normalize(leftAirport.ciudad) === normalize(rightAirport.ciudad);
  const sameState = normalize(leftAirport.estado || "") === normalize(rightAirport.estado || "");
  const sameCountry =
    normalize(leftAirport.country || "") === normalize(rightAirport.country || "");

  return sameCode || sameName || (sameCity && sameState && sameCountry);
}

function isRouteEndpointAtBase(routeItem, direction, baseAirport) {
  const airportCode = direction === "from" ? routeItem?.from_airport : routeItem?.to_airport;
  const endpointAirport = findAirport(airportCode);

  if (!endpointAirport) return false;

  return isSameAirportLocation(endpointAirport, baseAirport);
}

function buildPositioningRoute(aircraftId, fromAirport, toAirport, positioningType) {
  return {
    aircraft_id: aircraftId,
    from_airport: fromAirport,
    to_airport: toAirport,
    passengers: null,
    positioning: true,
    positioningType,
  };
}

function calculatePrice(routeItem, context = {}) {
  const aircraft = getAircraftById(getRouteAircraftId(routeItem));
  const from = findAirport(routeItem.from_airport);
  const to = findAirport(routeItem.to_airport);

  if (!aircraft || !from || !to) {
    return {
      ready: false,
      flightCost: 0,
      overnightCost: 0,
      operationalCost: 0,
      total: 0,
      hours: 0,
      estimatedHours: 0,
      cruiseHours: 0,
      billableHours: 0,
      miles: 0,
      hourlyRate: 0,
      speedKnots: 0,
      minimumHours: 0,
      minimumApplied: false,
      blockBufferHours: 0,
      adjustedDistanceNm: 0,
    };
  }

  const fromLat = Number(from.lat);
  const fromLng = Number(from.lng);
  const toLat = Number(to.lat);
  const toLng = Number(to.lng);

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return {
      ready: false,
      flightCost: 0,
      overnightCost: 0,
      operationalCost: 0,
      total: 0,
      hours: 0,
      estimatedHours: 0,
      cruiseHours: 0,
      billableHours: 0,
      miles: 0,
      hourlyRate: 0,
      speedKnots: 0,
      minimumHours: 0,
      minimumApplied: false,
      blockBufferHours: 0,
      adjustedDistanceNm: 0,
    };
  }

  const distanceNm = getDistanceNM(fromLat, fromLng, toLat, toLng);
  const speed = getAircraftCruiseSpeed(aircraft);
  const hourlyRate = getAircraftRentalRate(aircraft);

  if (!speed || speed <= 0) {
    return {
      ready: false,
      flightCost: 0,
      overnightCost: 0,
      operationalCost: 0,
      total: 0,
      hours: 0,
      estimatedHours: 0,
      cruiseHours: 0,
      billableHours: 0,
      miles: 0,
      hourlyRate,
      speedKnots: speed,
      minimumHours: 0,
      minimumApplied: false,
      blockBufferHours: 0,
      adjustedDistanceNm: 0,
    };
  }

  const isInternational = Boolean(context.isInternational ?? isInternationalFlight.value);
  const calculationMode = context.calculationMode || form.value.time_mode;
  const normalizedCalculationMode =
    calculationMode === "block_time" ? "block" : calculationMode;
  const cruiseHours = distanceNm / speed;
  let estimatedHours = 0;
  let blockBufferHours = 0;
  let adjustedDistanceNm = distanceNm;

  if (normalizedCalculationMode === "cruise") {
    estimatedHours = Math.ceil(cruiseHours * 4) / 4;
  } else {
    adjustedDistanceNm = distanceNm * (isInternational ? 1.15 : 1.12);
    const airTime = adjustedDistanceNm / speed;
    blockBufferHours =
      adjustedDistanceNm < 300
        ? 0.25
        : adjustedDistanceNm < 600
          ? 0.35
          : adjustedDistanceNm < 1000
            ? 0.45
            : 0.5;

    estimatedHours = Math.ceil((airTime + blockBufferHours) * 4) / 4;
  }

  const minimumHours = getMinHours(aircraft, adjustedDistanceNm);
  const billableHours = Math.max(estimatedHours, minimumHours);
  const minimumApplied = billableHours > estimatedHours;
  const flightCost = Number((billableHours * hourlyRate).toFixed(2));
  const nights = getNightsBetween(
    context.departureAt ?? form.value.departure_at,
    context.returnAt ?? form.value.return_at,
  );
  const crewOvernightUsd = toNumber(aircraft?.crew_overnight_usd, 0);
  const overnightRate =
    crewOvernightUsd > 0 ? crewOvernightUsd : hourlyRate * 0.5;
  const overnightCost = Number((nights * overnightRate).toFixed(2));
  const operationalCost = toNumber(
    isInternational
      ? aircraft.international_expenses_usd
      : aircraft.national_expenses_usd,
  );

  return {
    ready: true,
    flightCost,
    overnightCost,
    operationalCost,
    total: Number((flightCost + overnightCost).toFixed(2)),
    hours: billableHours,
    estimatedHours: Number(estimatedHours.toFixed(2)),
    cruiseHours: Number(cruiseHours.toFixed(2)),
    billableHours: Number(billableHours.toFixed(2)),
    miles: Number(distanceNm.toFixed(1)),
    hourlyRate,
    speedKnots: speed,
    minimumHours: Number(minimumHours.toFixed(2)),
    minimumApplied,
    blockBufferHours,
    adjustedDistanceNm: Number(adjustedDistanceNm.toFixed(1)),
  };
}

function calculateFlightQuote(input) {
  const aircraft = getAircraftById(input.aircraftId);
  const clientRoutes = input.routes.filter(
    (routeItem) =>
      Number(routeItem.passengers) > 0 &&
      normalize(routeItem.from_airport) &&
      normalize(routeItem.to_airport),
  );

  if (!aircraft) {
    throw new Error("Selecciona una aeronave para calcular.");
  }

  if (!clientRoutes.length) {
    throw new Error("Captura al menos una ruta valida.");
  }

  const isInternational = clientRoutes.some((routeItem) => {
    const from = findAirport(routeItem.from_airport);
    const to = findAirport(routeItem.to_airport);
    if (!from || !to) return false;
    return normalize(from.country) !== normalize(to.country);
  });
  const firstDepartureCountry = findAirport(clientRoutes[0].from_airport)?.country;
  const isInternationalFromMexico =
    isInternational && normalize(firstDepartureCountry) === "MEXICO";
  const calculationContext = {
    isInternational,
    calculationMode: input.calculationMode,
    departureAt: input.departureAt,
    returnAt: input.returnAt,
  };
  const baseAirport = getAircraftBaseAirport(input.aircraftId);
  const firstRoute = clientRoutes[0];
  const lastRoute = clientRoutes[clientRoutes.length - 1];
  const billableLegsInput = [];

  if (baseAirport?.iata && !isRouteEndpointAtBase(firstRoute, "from", baseAirport)) {
    billableLegsInput.push(
      buildPositioningRoute(
        input.aircraftId,
        baseAirport.iata,
        firstRoute.from_airport,
        "repositioning",
      ),
    );
  }

  billableLegsInput.push(
    ...clientRoutes.map((routeItem) => ({
      ...routeItem,
      aircraft_id: input.aircraftId,
      positioning: false,
      positioningType: "client",
    })),
  );

  if (baseAirport?.iata && !isRouteEndpointAtBase(lastRoute, "to", baseAirport)) {
    billableLegsInput.push(
      buildPositioningRoute(
        input.aircraftId,
        lastRoute.to_airport,
        baseAirport.iata,
        "return_to_base",
      ),
    );
  }

  const visibleRoutes = clientRoutes.map((routeItem) => {
    const breakdown = calculatePrice({
      ...routeItem,
      aircraft_id: input.aircraftId,
    }, calculationContext);

    return {
      ...routeItem,
      aircraft_id: input.aircraftId,
      from_airport: normalize(routeItem.from_airport),
      to_airport: normalize(routeItem.to_airport),
      passengers: normalizePassengerCount(routeItem.passengers),
      ...breakdown,
    };
  });

  const billableLegs = billableLegsInput.map((routeItem) => {
    const breakdown = calculatePrice(routeItem, calculationContext);

    return {
      ...routeItem,
      from_airport: normalize(routeItem.from_airport),
      to_airport: normalize(routeItem.to_airport),
      passengers: normalizePassengerCount(routeItem.passengers),
      ...breakdown,
    };
  });

  const invalidLeg = [...visibleRoutes, ...billableLegs].find((leg) => !leg.ready);

  if (invalidLeg) {
    throw new Error("Revisa aeropuertos y aeronave. No se pudo calcular alguna ruta.");
  }

  const clientFlightHours = visibleRoutes.reduce((sum, leg) => sum + leg.hours, 0);
  const billableHours = billableLegs.reduce((sum, leg) => sum + leg.hours, 0);
  const flightCost = billableLegs
    .filter((leg) => !leg.positioning)
    .reduce((sum, leg) => sum + leg.flightCost, 0);
  const repositioningCost = billableLegs
    .filter((leg) => leg.positioningType === "repositioning")
    .reduce((sum, leg) => sum + leg.flightCost, 0);
  const returnToBaseCost = billableLegs
    .filter((leg) => leg.positioningType === "return_to_base")
    .reduce((sum, leg) => sum + leg.flightCost, 0);
  const isAirOnly = input.quoteMode === "air_only";
  const overnightCost = isAirOnly ? 0 : visibleRoutes[0]?.overnightCost || 0;
  const operationalExpenses = isAirOnly
    ? 0
    : toNumber(
        isInternational
          ? aircraft.international_expenses_usd
          : aircraft.national_expenses_usd,
      );
  const subtotal = flightCost + repositioningCost + returnToBaseCost + overnightCost + operationalExpenses;
  const taxRate = isAirOnly ? 0 : isInternationalFromMexico ? 0.04 : isInternational ? 0.04 : 0.16;
  const taxAmount = isAirOnly ? 0 : Number((subtotal * taxRate).toFixed(2));
  const totalUsd = Number((subtotal + taxAmount).toFixed(2));
  const currentExchangeRate = toNumber(input.exchangeRate, 17.42);

  return {
    aircraft,
    visibleRoutes,
    billableLegs,
    totals: {
      clientFlightHours: Number(clientFlightHours.toFixed(2)),
      billableHours: Number(billableHours.toFixed(2)),
      hourlyRate: getAircraftRentalRate(aircraft),
      flightCost: Number(flightCost.toFixed(2)),
      repositioningCost: Number(repositioningCost.toFixed(2)),
      returnToBaseCost: Number(returnToBaseCost.toFixed(2)),
      overnightCost: Number(overnightCost.toFixed(2)),
      operationalExpenses: Number(operationalExpenses.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      taxRate,
      taxAmount,
      totalUsd,
      exchangeRate: currentExchangeRate,
      totalMxn: Number((totalUsd * currentExchangeRate).toFixed(2)),
      taxApplied: !isAirOnly && taxRate > 0,
      expensesIncluded: !isAirOnly,
    },
    meta: {
      quoteMode: input.quoteMode,
      calculationMode: input.calculationMode,
      isInternational,
      isInternationalFromMexico,
      departureAt: input.departureAt,
      returnAt: input.returnAt,
      routePreview: routePreview.value,
      aircraftName: aircraft.name || aircraft.registration || "-",
      baseAirport: baseAirport?.iata || aircraft.home_base || "-",
      taxLabel: isAirOnly
        ? "Impuestos no incluidos"
        : `${Math.round(taxRate * 100)}%`,
      expensesLabel: isAirOnly ? "Gastos no incluidos" : "Gastos incluidos",
      quoteModeLabel: isAirOnly ? "Solo aire" : "Completa",
      calculationModeLabel: input.calculationMode === "cruise" ? "Tiempo de crucero" : "Block time",
    },
  };
}

const validRoutes = computed(() =>
  routeItems.value.filter(
    (routeItem) =>
      Number(routeItem.passengers) > 0 &&
      getRouteAircraftId(routeItem) &&
      normalize(routeItem.from_airport) &&
      normalize(routeItem.to_airport),
  ),
);

const priceBreakdowns = computed(() => validRoutes.value.map((routeItem) => calculatePrice(routeItem)));

const billableRoutes = computed(() => {
  if (!validRoutes.value.length) return [];

  const firstRoute = validRoutes.value[0];
  const lastRoute = validRoutes.value[validRoutes.value.length - 1];
  const aircraftId = getRouteAircraftId(firstRoute);
  const aircraftBase = getAircraftBaseAirport(aircraftId);

  if (!aircraftBase?.iata) {
    return validRoutes.value.map((routeItem) => ({
      ...routeItem,
      aircraft_id: getRouteAircraftId(routeItem),
    }));
  }

  const baseAirport = aircraftBase.iata;
  const calculatedRoutes = [];

  if (!isRouteEndpointAtBase(firstRoute, "from", aircraftBase)) {
    calculatedRoutes.push(
      buildPositioningRoute(aircraftId, baseAirport, firstRoute.from_airport, "repositioning"),
    );
  }

  calculatedRoutes.push(
    ...validRoutes.value.map((routeItem) => ({
      ...routeItem,
      aircraft_id: getRouteAircraftId(routeItem),
    })),
  );

  if (!isRouteEndpointAtBase(lastRoute, "to", aircraftBase)) {
    calculatedRoutes.push(
      buildPositioningRoute(aircraftId, lastRoute.to_airport, baseAirport, "return_to_base"),
    );
  }

  return calculatedRoutes;
});

const billableBreakdowns = computed(() =>
  billableRoutes.value.map((routeItem) => calculatePrice(routeItem)),
);

const isAirOnlyQuote = computed(() => form.value.quote_mode === "air_only");

const flightCostTotal = computed(() =>
  billableBreakdowns.value.reduce((sum, item) => sum + item.flightCost, 0),
);

const overnightTotal = computed(() =>
  isAirOnlyQuote.value ? 0 : priceBreakdowns.value[0]?.overnightCost || 0,
);

const operationalExpenses = computed(() => {
  if (isAirOnlyQuote.value) return 0;

  const aircraft = getAircraftById(selectedAircraftId.value);
  if (!aircraft) return 0;

  return toNumber(
    isInternationalFlight.value
      ? aircraft.international_expenses_usd
      : aircraft.national_expenses_usd,
  );
});

const subtotal = computed(
  () => flightCostTotal.value + overnightTotal.value + operationalExpenses.value,
);

const taxRate = computed(() => (isInternationalFlight.value ? 0.04 : 0.16));
const taxAmount = computed(() =>
  isAirOnlyQuote.value ? 0 : Number((subtotal.value * taxRate.value).toFixed(2)),
);
const totalPrice = computed(() => Number((subtotal.value + taxAmount.value).toFixed(2)));
const previewTotals = computed(() => quotePreview.value?.totals || null);
const previewBillableLegs = computed(() => quotePreview.value?.billableLegs || []);
const previewVisibleRoutes = computed(() => quotePreview.value?.visibleRoutes || []);
const previewMeta = computed(() => quotePreview.value?.meta || null);

const routePreview = computed(() => {
  const legs = validRoutes.value;

  if (!legs.length) return "-";

  const path = [];

  legs.forEach((leg, index) => {
    const fromAirport = normalize(leg.from_airport);
    const toAirport = normalize(leg.to_airport);

    if (index === 0) {
      path.push(fromAirport, toAirport);
      return;
    }

    if (path[path.length - 1] !== fromAirport) {
      path.push(fromAirport);
    }

    path.push(toAirport);
  });

  if (path.length > 1 && path[path.length - 1] !== path[0]) {
    path.push(path[0]);
  }

  return path.join("-");
});

const routeAirportsPreview = computed(() => {
  const airportCodes = [];

  validRoutes.value.forEach((leg, index) => {
    const fromCode = normalize(leg.from_airport);
    const toCode = normalize(leg.to_airport);

    if (index === 0 || airportCodes[airportCodes.length - 1] !== fromCode) {
      airportCodes.push(fromCode);
    }

    airportCodes.push(toCode);
  });

  return airportCodes.map((code) => {
    const airport = findAirport(code);
    const airportName = airport?.aeropuerto || airport?.ciudad;
    return airportName ? `${airportName} - ${code}` : code;
  }).join(" / ");
});

function getAircraftTail(aircraft) {
  return (
    aircraft?.tail_number ||
    aircraft?.registration ||
    aircraft?.matricula ||
    aircraft?.tail ||
    null
  );
}

function buildAirportSnapshot(code) {
  const airport = findAirport(code);

  return {
    iata: normalize(getAirportOptionValue(airport) || code),
    icao: airport?.icao || airport?.ICAO || null,
    airport_name: airport?.aeropuerto || null,
    city: airport?.ciudad || null,
    country: airport?.country || null,
    latitude: airport?.lat == null ? null : Number(airport.lat),
    longitude: airport?.lng == null ? null : Number(airport.lng),
  };
}

function buildFlightQuotePayload(userId = null) {
  const preview = quotePreview.value;
  const totals = preview?.totals;
  const meta = preview?.meta;
  const aircraft = preview?.aircraft;

  if (!preview || !totals || !meta || !aircraft) {
    throw new Error("Primero calcula la cotizacion.");
  }

  const totalDistanceNm = preview.billableLegs.reduce(
    (sum, leg) => sum + toNumber(leg.miles),
    0,
  );

  return {
    quote_number: editingQuoteNumber.value || savedQuote.value?.quote_number || generateQuoteNumber(),
    status: "calculated",
    client_name: form.value.full_name.trim(),
    client_email: null,
    client_phone: null,
    flight_type: form.value.flight_type,
    quote_mode: form.value.quote_mode,
    time_mode: "block_time",
    operation_type: meta.isInternational ? "international" : "national",
    aircraft_id: aircraft.id,
    aircraft_name: aircraft.name || null,
    aircraft_tail: getAircraftTail(aircraft),
    aircraft_capacity: aircraft.capacity_passengers || null,
    aircraft_base: meta.baseAirport || aircraft.home_base || null,
    departure_at: toIsoOrNull(form.value.departure_at),
    return_at: toIsoOrNull(form.value.return_at),
    passengers: normalizePassengerCount(validRoutes.value[0]?.passengers),
    route_summary: routePreview.value,
    total_distance_nm: Number(totalDistanceNm.toFixed(2)),
    client_flight_hours: totals.clientFlightHours,
    billable_hours: totals.billableHours,
    hourly_rate_usd: totals.hourlyRate,
    flight_cost_usd: totals.flightCost,
    repositioning_cost_usd: totals.repositioningCost,
    return_to_base_cost_usd: totals.returnToBaseCost,
    overnight_cost_usd: totals.overnightCost,
    operational_expenses_usd: totals.operationalExpenses,
    subtotal_usd: totals.subtotal,
    tax_rate: totals.taxRate,
    tax_amount_usd: totals.taxAmount,
    total_usd: totals.totalUsd,
    exchange_rate: totals.exchangeRate,
    total_mxn: totals.totalMxn,
    notes: null,
    calculation_version: "v1",
    calculation_snapshot: preview,
    created_by: userId,
  };
}

function buildFlightQuoteLegPayloads(quoteId) {
  return previewBillableLegs.value.map((leg, index) => {
    const from = buildAirportSnapshot(leg.from_airport);
    const to = buildAirportSnapshot(leg.to_airport);
    const legType = leg.positioningType || "client";

    return {
      quote_id: quoteId,
      leg_order: index + 1,
      leg_type: legType,
      visible_to_client: legType === "client",
      from_iata: from.iata,
      from_icao: from.icao,
      from_airport_name: from.airport_name,
      from_city: from.city,
      from_country: from.country,
      from_latitude: from.latitude,
      from_longitude: from.longitude,
      to_iata: to.iata,
      to_icao: to.icao,
      to_airport_name: to.airport_name,
      to_city: to.city,
      to_country: to.country,
      to_latitude: to.latitude,
      to_longitude: to.longitude,
      distance_nm: leg.miles,
      cruise_speed_knots: leg.speedKnots,
      estimated_air_time: leg.cruiseHours,
      block_time: leg.estimatedHours,
      billable_hours: leg.billableHours,
      minimum_hours_applied: leg.minimumApplied,
      minimum_hours: leg.minimumHours,
      hourly_rate_usd: leg.hourlyRate,
      amount_usd: leg.flightCost,
      passengers: normalizePassengerCount(leg.passengers),
    };
  });
}

function addRoute() {
  const previous = routeItems.value[routeItems.value.length - 1] || emptyRoute();

  routeItems.value.push({
    from_airport: previous.to_airport || "",
    to_airport: "",
    passengers: normalizePassengerCount(previous.passengers) ?? "",
    aircraft_id: selectedAircraftId.value || "",
  });
}

function removeRoute(index) {
  if (routeItems.value.length === 1) return;
  routeItems.value.splice(index, 1);
}

watch(
  () => selectedAircraftId.value,
  (aircraftId) => {
    routeItems.value = routeItems.value.map((routeItem, index) => ({
      ...routeItem,
      aircraft_id: index === 0 ? aircraftId : routeItem.aircraft_id || aircraftId,
    }));
  },
  { immediate: true },
);

watch(
  [form, routeItems],
  () => {
    quotePreview.value = null;
    savedQuote.value = null;
  },
  { deep: true },
);

async function loadCatalogs() {
  loading.value = true;

  try {
    const [{ data: national }, { data: international }, { data: fleet }] = await Promise.all([
      supabase.from("aeropuertos_mexico").select("*"),
      supabase.from("airports_geo").select("*"),
      supabase.from("aircraft_fleet").select("*").eq("is_active", true).range(0, 4999),
    ]);

    const nationalAirports = (national || []).map((airport) => ({
      aeropuerto: airport.AEROPUERTO,
      iata: normalize(airport.IATA || airport.iata),
      icao: airport.ICAO || airport.icao || null,
      ciudad: airport.CIUDAD,
      estado: airport.ESTADO,
      country: "MEXICO",
      lat: airport.LATITUDE,
      lng: airport.LONGITUDE,
    }));

    const internationalAirports = (international || []).map((airport) => ({
      aeropuerto: airport.AEROPUERTO,
      iata: normalize(airport.IATA || airport.iata),
      icao: airport.ICAO || airport.icao || null,
      ciudad: airport.CIUDAD,
      estado: airport.ESTADO || "",
      country: airport.COUNTRY,
      lat: airport.LATITUDE,
      lng: airport.LONGITUDE,
    }));

    allAirports.value = [...nationalAirports, ...internationalAirports];
    aircraftFleet.value = fleet || [];
  } catch (error) {
    console.error("Unable to load quote catalogs", error);
    feedback.error("No se pudieron cargar catalogos", error);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingQuoteId.value = null;
  editingQuoteNumber.value = "";
  form.value = {
    full_name: DEFAULT_CLIENT_NAME,
    flight_type: "Private Jet",
    quote_mode: "complete",
    time_mode: "block",
    departure_at: "",
    return_at: "",
  };

  routeItems.value = [emptyRoute()];
  quotePreview.value = null;
  savedQuote.value = null;
}

function getEditableLegsFromQuote(quote) {
  const savedLegs = [...(quote?.flight_quote_legs || [])]
    .filter((leg) => leg.leg_type === "client" || leg.visible_to_client)
    .sort((left, right) => Number(left.leg_order || 0) - Number(right.leg_order || 0));

  if (savedLegs.length) {
    return savedLegs.map((leg) => ({
      from_airport: normalize(leg.from_iata || leg.from_icao),
      to_airport: normalize(leg.to_iata || leg.to_icao),
      passengers: normalizePassengerCount(leg.passengers ?? quote.passengers) ?? "",
      aircraft_id: quote.aircraft_id || "",
    }));
  }

  const codes = String(quote?.route_summary || "")
    .split("-")
    .map((code) => normalize(code))
    .filter(Boolean);

  const editableCodes =
    codes.length > 2 && codes[0] === codes[codes.length - 1]
      ? codes.slice(0, -1)
      : codes;

  if (editableCodes.length < 2) {
    return [{ ...emptyRoute(), aircraft_id: quote.aircraft_id || "" }];
  }

  return editableCodes.slice(0, -1).map((fromAirport, index) => ({
    from_airport: fromAirport,
    to_airport: editableCodes[index + 1],
    passengers: normalizePassengerCount(quote.passengers) ?? "",
    aircraft_id: quote.aircraft_id || "",
  }));
}

async function loadQuoteForEdit() {
  if (!editingQuoteId.value) return;

  loading.value = true;

  try {
    const { data, error } = await supabase
      .from("flight_quotes")
      .select(
        `
        *,
        flight_quote_legs (
          *
        )
      `,
      )
      .eq("id", editingQuoteId.value)
      .single();

    if (error) throw error;

    form.value = {
      full_name: data.client_name || DEFAULT_CLIENT_NAME,
      flight_type: data.flight_type || "Private Jet",
      quote_mode: data.quote_mode || "complete",
      time_mode: data.time_mode || "block",
      departure_at: toDateTimeLocalInput(data.departure_at),
      return_at: toDateTimeLocalInput(data.return_at),
    };

    routeItems.value = getEditableLegsFromQuote(data);
    editingQuoteNumber.value = data.quote_number || "";
    savedQuote.value = {
      id: data.id,
      quote_number: data.quote_number,
    };

    setTimeout(() => {
      handleCalculateQuote();
    }, 0);
  } catch (error) {
    console.error("Unable to load flight quote for edit", error);
    feedback.error("No se pudo cargar la cotizacion para editar", error);
  } finally {
    loading.value = false;
  }
}

function handleCalculateQuote() {
  if (!form.value.full_name.trim()) {
    feedback.warning("Nombre requerido", "Captura el nombre del cliente.");
    return;
  }

  if (!selectedAircraftId.value) {
    feedback.warning("Aeronave requerida", "Selecciona una aeronave para cotizar.");
    return;
  }

  if (!validRoutes.value.length) {
    feedback.warning("Rutas incompletas", "Captura al menos una ruta valida con origen y destino.");
    return;
  }

  try {
    quotePreview.value = calculateFlightQuote({
      aircraftId: selectedAircraftId.value,
      routes: validRoutes.value,
      departureAt: form.value.departure_at,
      returnAt: form.value.return_at,
      passengers: normalizePassengerCount(validRoutes.value[0]?.passengers),
      quoteMode: form.value.quote_mode,
      calculationMode: "block",
      exchangeRate: DEFAULT_EXCHANGE_RATE,
    });
    savedQuote.value = null;

    feedback.notify("Cotizacion calculada", "success");
  } catch (error) {
    console.error("Unable to calculate flight quote", error);
    feedback.error("No se pudo calcular la cotizacion", error);
  }
}

async function handleSaveQuote() {
  if (!quotePreview.value) {
    handleCalculateQuote();
  }

  if (!quotePreview.value) return;

  saving.value = true;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;
    const quotePayload = buildFlightQuotePayload(userId);

    const quoteRequest = isEditMode.value
      ? supabase
          .from("flight_quotes")
          .update(quotePayload)
          .eq("id", editingQuoteId.value)
          .select("id, quote_number")
          .single()
      : supabase
          .from("flight_quotes")
          .insert(quotePayload)
          .select("id, quote_number")
          .single();

    const { data: quote, error: quoteError } = await quoteRequest;

    if (quoteError) throw quoteError;

    const legsPayload = buildFlightQuoteLegPayloads(quote.id);

    if (isEditMode.value) {
      const { error: deleteLegsError } = await supabase
        .from("flight_quote_legs")
        .delete()
        .eq("quote_id", quote.id);

      if (deleteLegsError) throw deleteLegsError;
    }

    if (legsPayload.length) {
      const { error: legsError } = await supabase
        .from("flight_quote_legs")
        .insert(legsPayload);

      if (legsError) throw legsError;
    }

    savedQuote.value = quote;
    feedback.notify(
      `${isEditMode.value ? "Cotizacion actualizada" : "Cotizacion guardada"} ${quote.quote_number || ""}`.trim(),
      "success",
    );
    await router.push({
      name: "AdminQuotes",
      query: { pdf: quote.id },
    });
  } catch (error) {
    console.error("Unable to save flight quote", error);
    feedback.error("No se pudo guardar la cotizacion", error);
  } finally {
    saving.value = false;
  }
}

function downloadQuotePreviewPdf({ openInBrowser = false } = {}) {
  if (!quotePreview.value) {
    feedback.warning("Primero calcula la cotizacion", "Genera el preview antes de descargar el PDF.");
    return;
  }

  const doc = new jsPDF("p", "mm", "a4");
  const totals = quotePreview.value.totals;
  const aircraft = quotePreview.value.aircraft;
  const meta = quotePreview.value.meta;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Cotizacion de vuelo", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const passengerCount = normalizePassengerCount(validRoutes.value[0]?.passengers);
  let infoY = 30;

  doc.text(`Cliente: ${form.value.full_name || "-"}`, 14, infoY);
  infoY += 6;
  doc.text(`Aeronave: ${aircraft?.name || "-"}`, 14, infoY);
  infoY += 6;
  doc.text(`Ruta: ${routePreview.value}`, 14, infoY);
  infoY += 6;

  const airportLines = doc.splitTextToSize(
    `Aeropuertos: ${routeAirportsPreview.value || "-"}`,
    180,
  );
  doc.text(airportLines, 14, infoY);
  infoY += airportLines.length * 5 + 1;

  if (passengerCount) {
    doc.text(`Pasajeros: ${passengerCount}`, 14, infoY);
    infoY += 6;
  }

  doc.text(`Salida: ${form.value.departure_at || "-"}`, 14, infoY);
  infoY += 6;
  doc.text(`Regreso: ${form.value.return_at || "-"}`, 14, infoY);
  infoY += 6;
  doc.text(`Modo: ${meta.quoteModeLabel}`, 14, infoY);
  infoY += 6;
  doc.text(`Tiempo: ${meta.calculationModeLabel}`, 14, infoY);

  const totalsY = Math.max(92, infoY + 10);
  doc.setFont("helvetica", "bold");
  doc.text("Totales", 14, totalsY);
  doc.setFont("helvetica", "normal");
  doc.text(`Horas cliente: ${totals.clientFlightHours.toFixed(2)} h`, 14, totalsY + 8);
  doc.text(`Horas cobrables: ${totals.billableHours.toFixed(2)} h`, 14, totalsY + 14);
  doc.text(`Tarifa por hora: $${totals.hourlyRate.toFixed(2)} USD`, 14, totalsY + 20);
  doc.text(`Costo vuelo: $${totals.flightCost.toFixed(2)} USD`, 14, totalsY + 26);
  doc.text(`Reposicionamiento: $${totals.repositioningCost.toFixed(2)} USD`, 14, totalsY + 32);
  doc.text(`Regreso a base: $${totals.returnToBaseCost.toFixed(2)} USD`, 14, totalsY + 38);
  doc.text(`Pernocta: $${totals.overnightCost.toFixed(2)} USD`, 14, totalsY + 44);
  doc.text(`Gastos operativos: $${totals.operationalExpenses.toFixed(2)} USD (${meta.expensesLabel})`, 14, totalsY + 50);
  doc.text(`Subtotal: $${totals.subtotal.toFixed(2)} USD`, 14, totalsY + 56);
  doc.text(`IVA / Tax: $${totals.taxAmount.toFixed(2)} USD (${meta.taxLabel})`, 14, totalsY + 62);
  doc.text(`Total USD: $${totals.totalUsd.toFixed(2)} USD`, 14, totalsY + 68);
  doc.text(`Tipo de cambio: ${totals.exchangeRate.toFixed(2)}`, 14, totalsY + 74);
  doc.text(`Total MXN: $${totals.totalMxn.toFixed(2)} MXN`, 14, totalsY + 80);

  const debugY = totalsY + 94;
  doc.setFont("helvetica", "bold");
  doc.text("Debug admin", 14, debugY);
  doc.setFont("helvetica", "normal");
  doc.text(`Aeronave: ${meta.aircraftName}`, 14, debugY + 8);
  doc.text(`Base: ${meta.baseAirport}`, 14, debugY + 14);
  doc.text(`Tarifa usada: $${totals.hourlyRate.toFixed(2)} USD/h`, 14, debugY + 20);
  doc.text(`Operacion: ${meta.isInternational ? "Internacional" : "Nacional"}`, 14, debugY + 26);
  doc.text(`Tax aplicado: ${totals.taxApplied ? "Si" : "No"}`, 14, debugY + 32);

  const billableLegsY = debugY + 44;
  doc.setFont("helvetica", "bold");
  doc.text("Tramos cobrables", 14, billableLegsY);
  doc.setFont("helvetica", "normal");

  let y = billableLegsY + 8;
  quotePreview.value.billableLegs.forEach((leg, index) => {
    if (y > 280) {
      doc.addPage();
      y = 18;
    }

    doc.text(
      `${index + 1}. ${leg.from_airport} -> ${leg.to_airport} | ${leg.miles.toFixed(0)} nm | est ${leg.estimatedHours.toFixed(2)} h | cob ${leg.billableHours.toFixed(2)} h | $${leg.flightCost.toFixed(2)}`,
      14,
      y,
    );
    y += 6;
    doc.text(
      `   ${leg.speedKnots} kt | min ${leg.minimumHours.toFixed(2)} h | minimo ${leg.minimumApplied ? "si" : "no"} | ${leg.positioningType || "client"}`,
      14,
      y,
    );
    y += 7;
  });

  const routeName = String(savedQuote.value?.route_summary || "")
    .trim()
    .toUpperCase()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const aircraftName = String(savedQuote.value?.aircraft_name || "")
    .trim()
    .toUpperCase()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const pdfFileName = routeName && aircraftName
    ? `${routeName}-${aircraftName}.pdf`
    : `${routeName || aircraftName || savedQuote.value?.quote_number || `flight-quote-${Date.now()}`}.pdf`;

  if (openInBrowser) {
    const pdfUrl = URL.createObjectURL(doc.output("blob"));
    window.location.assign(pdfUrl);
    return;
  }

  doc.save(pdfFileName);
}

onMounted(async () => {
  await loadCatalogs();
  await loadQuoteForEdit();
});
</script>

<template>
  <section class="page-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Cotizaciones de vuelo</p>
        <h1>Cotizacion de vuelo</h1>
        <p class="subtitle">
          Genera cotizaciones internas de vuelo desde el admin sin depender del sitio web.
        </p>
      </div>

      <div class="hero-badge">
        <span>{{ validRoutes.length }}</span>
        <small>{{ validRoutes.length === 1 ? "ruta valida" : "rutas validas" }}</small>
      </div>
    </header>

    <div v-if="loading" class="state-card">Cargando catalogos operativos...</div>

    <div v-else class="layout-grid">
      <form class="editor-card" @submit.prevent="handleCalculateQuote">
        <section class="section-block">
          <div class="section-head">
            <h2>Cliente</h2>
          </div>

          <div class="form-grid two-columns">
            <label class="field">
              <span>Nombre</span>
              <input v-model="form.full_name" type="text" placeholder="Nombre del cliente" />
            </label>

            <label class="field">
              <span>Tipo de vuelo</span>
              <select v-model="form.flight_type">
                <option v-for="option in flightTypeOptions" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
            </label>

          </div>
        </section>

        <section class="section-block">
          <div class="section-head">
            <h2>Operacion</h2>
          </div>

          <div class="form-grid two-columns">
            <label class="field">
              <span>Aeronave</span>
              <select v-model="routeItems[0].aircraft_id">
                <option value="">Selecciona una aeronave</option>
                <option v-for="aircraft in filteredFleet" :key="aircraft.id" :value="aircraft.id">
                  {{ aircraft.name }} · {{ aircraft.capacity_passengers }} pasajeros  {{ aircraft.iata || "-" }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Salida</span>
              <input v-model="form.departure_at" type="datetime-local" />
            </label>

            <label class="field">
              <span>Regreso</span>
              <input v-model="form.return_at" type="datetime-local" />
            </label>

          </div>
        </section>

        <section class="section-block">
          <div class="section-head">
            <h2>Rutas</h2>
            <button type="button" class="ghost-btn" @click="addRoute">Agregar ruta</button>
          </div>

          <div class="route-stack">
            <article
              v-for="(routeItem, index) in routeItems"
              :key="index"
              class="route-card"
            >
              <div class="route-card-head">
                <strong>Ruta {{ index + 1 }}</strong>
                <button
                  v-if="routeItems.length > 1"
                  type="button"
                  class="remove-btn"
                  @click="removeRoute(index)"
                >
                  Quitar
                </button>
              </div>

              <div class="form-grid route-grid">
                <label class="field">
                  <span>Origen (IATA)</span>
                  <input
                    v-model="routeItem.from_airport"
                    list="airport-options"
                    type="text"
                    placeholder="TLC"
                  />
                </label>

                <label class="field">
                  <span>Destino (IATA)</span>
                  <input
                    v-model="routeItem.to_airport"
                    list="airport-options"
                    type="text"
                    placeholder="MEX"
                  />
                </label>

                <label class="field">
                  <span>Pasajeros</span>
                  <input
                    v-model="routeItem.passengers"
                    type="number"
                    min="1"
                    :max="selectedAircraft?.capacity_passengers || undefined"
                  />
                </label>

                <div class="route-meta">
                  <span>{{ findAirport(routeItem.from_airport)?.ciudad || "Origen sin validar" }}</span>
                  <span>{{ findAirport(routeItem.to_airport)?.ciudad || "Destino sin validar" }}</span>
                </div>
              </div>
            </article>
          </div>

          <datalist id="airport-options">
            <option
              v-for="airport in airportOptions"
              :key="airport.iata"
              :value="airport.iata"
            >
              {{ airport.iata }} - {{ airport.ciudad }} - {{ airport.country }}
            </option>
          </datalist>
        </section>

        <div class="actions">
          <button
            v-if="quotePreview"
            class="ghost-btn"
            type="button"
            @click="downloadQuotePreviewPdf"
          >
            Descargar PDF
          </button>
          <button
            v-if="quotePreview"
            class="ghost-btn"
            type="button"
            :disabled="saving"
            @click="handleSaveQuote"
          >
            {{ saving ? "Guardando..." : isEditMode ? "Actualizar cotizacion" : "Guardar cotizacion" }}
          </button>
          <button class="primary-btn" type="submit">
            Calcular cotizacion
          </button>
        </div>
        <p v-if="savedQuote" class="saved-note">
          Cotizacion guardada: <strong>{{ savedQuote.quote_number }}</strong>
        </p>
      </form>

      <aside class="summary-card">
        <div class="summary-header">
          <p class="eyebrow">Resumen</p>
          <h2>{{ selectedAircraft?.name || "Sin aeronave" }}</h2>
        </div>

        <div class="summary-grid">
          <article>
            <span>Ruta</span>
            <strong>{{ routePreview }}</strong>
          </article>
          <article>
            <span>Operacion</span>
            <strong>{{ previewMeta ? (previewMeta.isInternational ? "Internacional" : "Nacional") : (isInternationalFlight ? "Internacional" : "Nacional") }}</strong>
          </article>
          <article>
            <span>Modo</span>
            <strong>{{ previewMeta?.quoteModeLabel || (isAirOnlyQuote ? "Solo aire" : "Completa") }}</strong>
          </article>
          <article>
            <span>Tiempo</span>
            <strong>{{ previewMeta?.calculationModeLabel || "Block time" }}</strong>
          </article>
          <article>
            <span>Costo vuelo</span>
            <strong>${{ (previewTotals?.flightCost ?? flightCostTotal).toFixed(2) }}</strong>
          </article>
          <article>
            <span>Pernocta</span>
            <strong>${{ (previewTotals?.overnightCost ?? overnightTotal).toFixed(2) }}</strong>
          </article>
          <article>
            <span>Gastos operativos</span>
            <strong>${{ (previewTotals?.operationalExpenses ?? operationalExpenses).toFixed(2) }}</strong>
          </article>
          <article>
            <span>Impuesto</span>
            <strong>{{ previewMeta?.taxLabel || (isAirOnlyQuote ? "Impuestos no incluidos" : `${Math.round((previewTotals?.taxRate ?? taxRate) * 100)}%`) }}</strong>
          </article>
          <article>
            <span>Horas cliente</span>
            <strong>{{ (previewTotals?.clientFlightHours ?? 0).toFixed(2) }} h</strong>
          </article>
          <article>
            <span>Horas cobrables</span>
            <strong>{{ (previewTotals?.billableHours ?? 0).toFixed(2) }} h</strong>
          </article>
          <article>
            <span>Tarifa por hora</span>
            <strong>${{ (previewTotals?.hourlyRate ?? 0).toFixed(2) }}</strong>
          </article>
          <article>
            <span>Total MXN</span>
            <strong>${{ (previewTotals?.totalMxn ?? 0).toFixed(2) }}</strong>
          </article>
        </div>

        <div v-if="quotePreview" class="admin-breakdown">
          <h3>Desglose admin</h3>
          <div class="admin-grid">
            <article>
              <span>Reposicionamiento</span>
              <strong>${{ previewTotals.repositioningCost.toFixed(2) }}</strong>
            </article>
            <article>
              <span>Regreso a base</span>
              <strong>${{ previewTotals.returnToBaseCost.toFixed(2) }}</strong>
            </article>
            <article>
              <span>Subtotal</span>
              <strong>${{ previewTotals.subtotal.toFixed(2) }}</strong>
            </article>
            <article>
              <span>IVA / Tax</span>
              <strong>${{ previewTotals.taxAmount.toFixed(2) }} - {{ previewMeta.taxLabel }}</strong>
            </article>
            <article>
              <span>Gastos</span>
              <strong>{{ previewMeta.expensesLabel }}</strong>
            </article>
            <article>
              <span>Aeronave calculada</span>
              <strong>{{ previewMeta.aircraftName }}</strong>
            </article>
            <article>
              <span>Base</span>
              <strong>{{ previewMeta.baseAirport }}</strong>
            </article>
            <article>
              <span>Tax aplicado</span>
              <strong>{{ previewTotals.taxApplied ? "Si" : "No" }}</strong>
            </article>
            <article>
              <span>Tipo de cambio</span>
              <strong>{{ previewTotals.exchangeRate.toFixed(2) }}</strong>
            </article>
            <article>
              <span>Modo tiempo</span>
              <strong>{{ previewMeta.calculationModeLabel }}</strong>
            </article>
          </div>
        </div>

        <div class="legs-list">
          <div
            v-for="(breakdown, index) in (quotePreview ? previewBillableLegs : billableBreakdowns)"
            :key="index"
            class="leg-row"
          >
            <div>
              <strong>{{ breakdown.from_airport || billableRoutes[index]?.from_airport || "-" }} -> {{ breakdown.to_airport || billableRoutes[index]?.to_airport || "-" }}</strong>
              <span>
                {{ breakdown.miles.toFixed(0) }} nm - est {{ (breakdown.estimatedHours ?? breakdown.hours).toFixed(2) }} h - cob {{ (breakdown.billableHours ?? breakdown.hours).toFixed(2) }} h
              </span>
              <span v-if="quotePreview" class="leg-admin-meta">
                {{ breakdown.speedKnots }} kt - tarifa ${{ breakdown.hourlyRate.toFixed(2) }}/h - min {{ breakdown.minimumHours.toFixed(2) }} h - minimo {{ breakdown.minimumApplied ? "si" : "no" }}
                <template v-if="breakdown.positioningType === 'repositioning'"> - reposicionamiento</template>
                <template v-if="breakdown.positioningType === 'return_to_base'"> - regreso a base</template>
              </span>
            </div>
            <strong>${{ breakdown.flightCost.toFixed(2) }}</strong>
          </div>
        </div>

        <div class="total-box">
          <span>Total estimado</span>
            <strong>${{ (previewTotals?.totalUsd ?? totalPrice).toFixed(2) }} USD</strong>
            <small v-if="quotePreview">${{ previewTotals.totalMxn.toFixed(2) }} MXN</small>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: #0f5fa6;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  font-size: 2rem;
}

.subtitle {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  max-width: 680px;
}

.hero-badge {
  min-width: 150px;
  padding: 1rem 1.1rem;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(15, 95, 166, 0.12), rgba(15, 95, 166, 0.04));
  border: 1px solid rgba(15, 95, 166, 0.12);
  text-align: center;
}

.hero-badge span {
  display: block;
  color: #0f5fa6;
  font-size: 1.6rem;
  font-weight: 800;
}

.hero-badge small {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.state-card,
.editor-card,
.summary-card {
  border-radius: 28px;
  background: white;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
}

.state-card {
  padding: 2rem;
  text-align: center;
}

.layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.85fr);
  gap: 1.25rem;
  align-items: start;
}

.editor-card {
  padding: 1.25rem;
}

.section-block + .section-block {
  margin-top: 1.2rem;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.section-head h2,
.summary-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.form-grid {
  display: grid;
  gap: 0.9rem;
}

.two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.route-grid {
  grid-template-columns: 1fr 1fr 140px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
}

.field span {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.field-help {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.35;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 14px;
  border: 1px solid rgba(15, 95, 166, 0.18);
  background: rgba(248, 250, 252, 0.92);
  font: inherit;
  color: var(--text-main);
}

.field textarea {
  resize: vertical;
  min-height: 96px;
}

.route-stack {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.route-card {
  padding: 1rem;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(15, 95, 166, 0.05), rgba(15, 95, 166, 0.02));
  border: 1px solid rgba(15, 95, 166, 0.1);
}

.route-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.route-meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-muted);
  font-size: 0.78rem;
}

.actions {
  margin-top: 1.25rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.primary-btn,
.ghost-btn,
.remove-btn {
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 700;
}

.primary-btn {
  padding: 0.9rem 1.3rem;
  background: linear-gradient(135deg, #0f5fa6, #0b4c86);
  color: white;
}

.ghost-btn,
.remove-btn {
  padding: 0.62rem 0.9rem;
  background: rgba(15, 95, 166, 0.09);
  color: #0f5fa6;
}

.primary-btn:disabled,
.ghost-btn:disabled,
.remove-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.saved-note {
  margin: 0.85rem 0 0;
  color: #0f766e;
  font-size: 0.9rem;
  font-weight: 700;
  text-align: right;
}

.summary-card {
  position: sticky;
  top: 18px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}

.summary-grid article {
  padding: 0.9rem;
  border-radius: 18px;
  background: rgba(15, 95, 166, 0.05);
  border: 1px solid rgba(15, 95, 166, 0.08);
}

.summary-grid span,
.leg-row span {
  display: block;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.summary-grid strong,
.leg-row strong {
  color: var(--text-strong);
}

.admin-breakdown {
  padding: 0.95rem;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid rgba(15, 95, 166, 0.1);
}

.admin-breakdown h3 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.admin-grid article {
  padding: 0.7rem;
  border-radius: 14px;
  background: white;
  border: 1px solid rgba(15, 95, 166, 0.08);
}

.admin-grid span,
.leg-admin-meta {
  display: block;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.admin-grid strong {
  color: var(--text-strong);
  font-size: 0.9rem;
}

.legs-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.leg-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding: 0.85rem 0.95rem;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.95);
  border: 1px solid rgba(15, 95, 166, 0.08);
}

.total-box {
  margin-top: auto;
  padding: 1rem 1.1rem;
  border-radius: 20px;
  background: linear-gradient(135deg, #0f172a, #123456);
  color: white;
}

.total-box span {
  display: block;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.total-box strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.7rem;
}

.total-box small {
  display: block;
  margin-top: 0.35rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.95rem;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .summary-card {
    position: static;
  }
}

@media (max-width: 760px) {
  .two-columns,
  .route-grid,
  .summary-grid,
  .admin-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    flex-direction: column;
  }
}
</style>
