<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "@/supabase";
import { useFeedback } from "@/composables/useFeedback";

const router = useRouter();
const feedback = useFeedback();

const COMMERCIAL_MARGIN_RATE = 0.15;
const OTHER_CHARGES_DEFAULT = 0;
const HELICOPTER_MAX_LEG_DISTANCE_NM = 200;
const AIRCRAFT_TYPE_OPERATIONAL_MARGINS = {
  HELICOPTERO: {
    operationalMarginMinutes: 15,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 350,
  },
  "MONOMOTOR PISTON": {
    operationalMarginMinutes: 15,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 250,
  },
  TURBOHELICE: {
    operationalMarginMinutes: 20,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 450,
  },
  "JET LIGERO (LIGHT JET)": {
    operationalMarginMinutes: 30,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 650,
  },
  "MIDSIZE JET (MID JET)": {
    operationalMarginMinutes: 30,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 850,
  },
  "SUPER MIDSIZE JET": {
    operationalMarginMinutes: 35,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 1000,
  },
  "HEAVY JET": {
    operationalMarginMinutes: 40,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 1200,
  },
  "REGIONAL JET": {
    operationalMarginMinutes: 40,
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    overnightFeeUsd: 950,
  },
};
const AIRCRAFT_MODEL_PRICING_OVERRIDES = {
  "LEAR JET 31": {
    applyCommercialMargin: true,
    commercialMarginPercent: 15,
    airportFeesUsd: 500,
    overnightFeeUsd: 0,
  },
};

const loading = ref(false);
const saving = ref(false);
const hasCalculated = ref(false);
const aircraftFleet = ref([]);
const allAirports = ref([]);
const routes = ref([emptyRoute()]);
const DEFAULT_EXCHANGE_RATE = 17.42;

function emptyRoute() {
  return {
    id: Date.now() + Math.random(),
    fromAirport: "",
    fromCity: "",
    fromState: "",
    fromCountry: "",
    toAirport: "",
    toCity: "",
    toState: "",
    toCountry: "",
    passengers: 1,
    aircraft_id: null,
    start_date: "",
    end_date: "",
  };
}

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(toNumber(value, 0));
}

function formatCurrencyCompact(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(toNumber(value, 0));
}

function formatHours(minutes) {
  const totalMinutes = Math.round(toNumber(minutes, 0));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function generateQuoteNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const timePart = String(now.getTime()).slice(-5);
  return `FQ-${datePart}-${timePart}`;
}

function getAirportOptionValue(airport) {
  return String(airport?.iata || airport?.IATA || airport?.aeropuerto || "")
    .trim()
    .toUpperCase();
}

function getAirportOptionLabel(airport) {
  const code = getAirportOptionValue(airport);
  const city = String(airport?.ciudad || "").trim();
  const airportName = String(airport?.aeropuerto || "").trim();
  const country = String(airport?.country || "").trim();

  return [code, city, airportName, country].filter(Boolean).join(" · ");
}

const airportOptions = computed(() =>
  allAirports.value
    .filter((airport) => getAirportOptionValue(airport))
    .slice()
    .sort((left, right) =>
      `${left.ciudad || ""} ${getAirportOptionValue(left)}`.localeCompare(
        `${right.ciudad || ""} ${getAirportOptionValue(right)}`,
      ),
    ),
);

const selectedAircraftId = computed(() => routes.value[0]?.aircraft_id || null);

function getAircraftById(id) {
  return (
    aircraftFleet.value.find((aircraft) => String(aircraft.id) === String(id)) || null
  );
}

const selectedAircraft = computed(() => getAircraftById(selectedAircraftId.value));

const filteredFleet = computed(() => {
  const maxPassengers = Math.max(
    ...routes.value.map((routeItem) => toNumber(routeItem.passengers, 1)),
  );

  return aircraftFleet.value
    .filter((aircraft) => toNumber(aircraft.capacity_passengers, 0) >= maxPassengers)
    .filter((aircraft) =>
      hasLongHelicopterLeg.value ? !isHelicopterAircraft(aircraft) : true,
    )
    .slice()
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
});

function assignAirportToRoute(routeItem, direction, airportCode) {
  const airport = findAirportForCode(airportCode);
  const prefix = direction === "from" ? "from" : "to";

  routeItem[`${prefix}Airport`] = getAirportOptionValue(airport) || norm(airportCode);
  routeItem[`${prefix}City`] = airport?.ciudad || "";
  routeItem[`${prefix}State`] = airport?.estado || "";
  routeItem[`${prefix}Country`] = airport?.country || "";
}

function findAirportForCode(airportCode) {
  return (
    allAirports.value.find(
      (airport) =>
        norm(getAirportOptionValue(airport)) === norm(airportCode) ||
        norm(airport.aeropuerto) === norm(airportCode),
    ) || null
  );
}

function findAirportForRoute(routeItem, direction) {
  const airportValue =
    direction === "from" ? routeItem?.fromAirport : routeItem?.toAirport;
  const city = direction === "from" ? routeItem?.fromCity : routeItem?.toCity;
  const state = direction === "from" ? routeItem?.fromState : routeItem?.toState;
  const country =
    direction === "from" ? routeItem?.fromCountry : routeItem?.toCountry;

  const directMatch = allAirports.value.find(
    (airport) =>
      norm(getAirportOptionValue(airport)) === norm(airportValue) ||
      norm(airport.aeropuerto) === norm(airportValue),
  );

  if (directMatch) return directMatch;

  const candidates = allAirports.value.filter((airport) => {
    const sameCity = norm(airport.ciudad) === norm(city);
    const sameState = state ? norm(airport.estado) === norm(state) : true;
    const sameCountry = country ? norm(airport.country) === norm(country) : true;
    return sameCity && sameState && sameCountry;
  });

  if (candidates.length === 1) return candidates[0];

  return (
    candidates.find(
      (airport) =>
        norm(getAirportOptionValue(airport)) === norm(airportValue) ||
        norm(airport.aeropuerto) === norm(airportValue),
    ) || null
  );
}

function getRouteAircraftId(routeItem) {
  return routeItem?.aircraft_id || selectedAircraftId.value || null;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function getDistanceNM(lat1, lon1, lat2, lon2) {
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return (radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / 1.852;
}

function getRouteLegDistanceNm(routeItem) {
  if (!routeItem?.fromAirport || !routeItem?.toAirport) return null;

  const from = findAirportForRoute(routeItem, "from");
  const to = findAirportForRoute(routeItem, "to");

  if (!from || !to) return null;

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
    return null;
  }

  return getDistanceNM(fromLat, fromLng, toLat, toLng);
}

const hasLongHelicopterLeg = computed(() =>
  routes.value.some((routeItem) => {
    const distanceNm = getRouteLegDistanceNm(routeItem);
    return distanceNm !== null && distanceNm > HELICOPTER_MAX_LEG_DISTANCE_NM;
  }),
);

function isHelicopterAircraft(aircraft) {
  const aircraftType = norm(aircraft?.aircraft_type || aircraft?.type || "");
  return aircraftType.includes("HELICOP");
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

function getOperationalRuleByAircraftType(aircraftType) {
  const normalizedType = norm(aircraftType);

  if (AIRCRAFT_TYPE_OPERATIONAL_MARGINS[normalizedType]) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS[normalizedType];
  }
  if (normalizedType.includes("HELICOP")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS.HELICOPTERO;
  }
  if (normalizedType.includes("PISTON")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS["MONOMOTOR PISTON"];
  }
  if (normalizedType.includes("TURBO")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS.TURBOHELICE;
  }
  if (normalizedType.includes("LIGHT")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS["JET LIGERO (LIGHT JET)"];
  }
  if (normalizedType.includes("MIDSIZE") || normalizedType.includes("MID JET")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS["MIDSIZE JET (MID JET)"];
  }
  if (normalizedType.includes("SUPER MIDSIZE")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS["SUPER MIDSIZE JET"];
  }
  if (normalizedType.includes("HEAVY")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS["HEAVY JET"];
  }
  if (normalizedType.includes("REGIONAL")) {
    return AIRCRAFT_TYPE_OPERATIONAL_MARGINS["REGIONAL JET"];
  }

  return {
    operationalMarginMinutes: 30,
  };
}

function calcularTiempoVuelo({
  distanciaNm,
  velocidadKnots,
  aircraftType,
  margenOperativoMin = null,
}) {
  const reglaBase = getOperationalRuleByAircraftType(aircraftType);
  const margenMin = toNumber(margenOperativoMin, reglaBase.operationalMarginMinutes);
  const tiempoRealMin = (distanciaNm / velocidadKnots) * 60;
  const tiempoEstimadoMin = tiempoRealMin + margenMin;
  const minutosEstimados = Math.ceil(tiempoEstimadoMin);

  return {
    margenOperativoMin: margenMin,
    baseMinutes: Math.ceil(tiempoRealMin),
    estimatedMinutes: minutosEstimados,
    baseDecimalHours: tiempoRealMin / 60,
    estimatedDecimalHours: minutosEstimados / 60,
  };
}

function getAircraftPricingDefaults(aircraft) {
  if (!aircraft) {
    return {
      operationalMarginMinutes: 20,
      applyCommercialMargin: true,
      commercialMarginPercent: COMMERCIAL_MARGIN_RATE * 100,
      airportFeesUsd: 0,
      overnightFeeUsd: 0,
      otherChargesUsd: 0,
    };
  }

  const normalizedName = String(aircraft.name || "").trim().toUpperCase();
  const normalizedType = norm(aircraft.aircraft_type || aircraft.type || "");
  const typeDefaults =
    AIRCRAFT_TYPE_OPERATIONAL_MARGINS[normalizedType] ||
    getOperationalRuleByAircraftType(aircraft.aircraft_type || aircraft.type || "");
  const namedDefaults = AIRCRAFT_MODEL_PRICING_OVERRIDES[normalizedName] || {};

  const fallbackOperationalMarginMinutes =
    toNumber(typeDefaults.operationalMarginMinutes) || 30;
  const fallbackApplyCommercialMargin =
    namedDefaults.applyCommercialMargin ??
    typeDefaults.applyCommercialMargin ??
    true;
  const fallbackCommercialMarginPercent =
    toNumber(namedDefaults.commercialMarginPercent) ||
    toNumber(typeDefaults.commercialMarginPercent) ||
    COMMERCIAL_MARGIN_RATE * 100;
  const fallbackAirportFeesUsd =
    toNumber(namedDefaults.airportFeesUsd) || toNumber(typeDefaults.airportFeesUsd);
  const fallbackOvernightFeeUsd =
    toNumber(namedDefaults.overnightFeeUsd) || toNumber(typeDefaults.overnightFeeUsd);
  const fallbackOtherChargesUsd =
    toNumber(namedDefaults.otherChargesUsd) || toNumber(typeDefaults.otherChargesUsd);
  const rentalRateUsd = getAircraftRentalRate(aircraft);
  const derivedOvernightFeeUsd =
    rentalRateUsd > 0 ? Number((rentalRateUsd / 2).toFixed(2)) : 0;
  const aircraftOvernightFeeUsd = toNumber(
    aircraft?.overnight_fee_usd ??
      aircraft?.overnightFeeUsd ??
      aircraft?.crew_overnight_usd ??
      aircraft?.crewOvernightUsd,
  );

  return {
    operationalMarginMinutes: fallbackOperationalMarginMinutes,
    applyCommercialMargin:
      aircraft?.apply_commercial_margin ??
      aircraft?.applyCommercialMargin ??
      fallbackApplyCommercialMargin,
    commercialMarginPercent: toNumber(
      aircraft?.commercial_margin_percent ??
        aircraft?.commercialMarginPercent,
      fallbackCommercialMarginPercent,
    ),
    airportFeesUsd: toNumber(
      aircraft?.airport_fees_usd ??
        aircraft?.airportFeesUsd ??
        aircraft?.national_expenses_usd ??
        aircraft?.international_expenses_usd,
      fallbackAirportFeesUsd,
    ),
    overnightFeeUsd:
      aircraftOvernightFeeUsd > 0
        ? aircraftOvernightFeeUsd
        : derivedOvernightFeeUsd || fallbackOvernightFeeUsd,
    otherChargesUsd: toNumber(
      aircraft?.other_charges_usd ?? aircraft?.otherChargesUsd,
      fallbackOtherChargesUsd,
    ),
  };
}

function getAircraftOptionLabel(aircraft) {
  if (!aircraft) return "Selecciona una aeronave";

  const base = aircraft.home_base || aircraft.base || aircraft.iata || "-";

  return [
    `${aircraft.name || "Aeronave"} · ${aircraft.capacity_passengers || "-"} pax · ${base}`,
    getAircraftCostSummary(aircraft),
  ].join(" · ");
}

function getAircraftCostSummary(aircraft) {
  if (!aircraft) return "";

  const pricing = getAircraftPricingDefaults(aircraft);

  return [
    `Renta ${formatCurrencyCompact(getAircraftRentalRate(aircraft))}`,
    `Pernocta ${formatCurrencyCompact(pricing.overnightFeeUsd)}`,
    `Ops ${formatCurrencyCompact(pricing.airportFeesUsd)}`,
  ].join(" · ");
}

function getAircraftBaseAirport(aircraftId) {
  const aircraft = getAircraftById(aircraftId);
  if (!aircraft) return null;

  const baseReference = aircraft.iata || aircraft.home_base || aircraft.base;
  if (!baseReference) return null;

  const iata = norm(baseReference);

  let match = allAirports.value.find(
    (airport) => norm(getAirportOptionValue(airport)) === iata,
  );
  if (match) return match;

  match = allAirports.value.find(
    (airport) => norm(airport.aeropuerto) === iata || norm(airport.ciudad) === iata,
  );
  if (match) return match;

  match = allAirports.value.find(
    (airport) =>
      norm(airport.ciudad) === norm(aircraft.ciudad || aircraft.city) &&
      (!(aircraft.estado || aircraft.state) ||
        norm(airport.estado) === norm(aircraft.estado || aircraft.state)),
  );

  return match || null;
}

function isSameAirportLocation(leftAirport, rightAirport) {
  if (!leftAirport || !rightAirport) return false;

  const sameCode =
    norm(getAirportOptionValue(leftAirport)) ===
    norm(getAirportOptionValue(rightAirport));
  const sameName = norm(leftAirport.aeropuerto) === norm(rightAirport.aeropuerto);
  const sameCity = norm(leftAirport.ciudad) === norm(rightAirport.ciudad);
  const sameState =
    norm(leftAirport.estado || "") === norm(rightAirport.estado || "");
  const sameCountry =
    norm(leftAirport.country || "") === norm(rightAirport.country || "");

  return sameCode || sameName || (sameCity && sameState && sameCountry);
}

function isRouteEndpointAtBase(routeItem, direction, baseAirport) {
  const endpointAirport = findAirportForRoute(routeItem, direction);
  if (!endpointAirport) return false;
  return isSameAirportLocation(endpointAirport, baseAirport);
}

function itineraryStartsAndEndsAtBase(routeItems, baseAirport) {
  if (!routeItems?.length || !baseAirport) return false;

  const firstRoute = routeItems[0];
  const lastRoute = routeItems[routeItems.length - 1];

  return (
    isRouteEndpointAtBase(firstRoute, "from", baseAirport) &&
    isRouteEndpointAtBase(lastRoute, "to", baseAirport)
  );
}

function buildPositioningRoute(
  aircraftId,
  fromAirport,
  toAirport,
  positioningType = "repositioning",
) {
  const resolveAirportCode = (airport) =>
    typeof airport === "string" ? airport : getAirportOptionValue(airport);

  return {
    id: `${positioningType}-${Date.now()}-${Math.random()}`,
    aircraft_id: aircraftId,
    fromAirport: resolveAirportCode(fromAirport),
    fromCity: fromAirport?.ciudad || "",
    fromState: fromAirport?.estado || "",
    fromCountry: fromAirport?.country || "",
    toAirport: resolveAirportCode(toAirport),
    toCity: toAirport?.ciudad || "",
    toState: toAirport?.estado || "",
    toCountry: toAirport?.country || "",
    passengers: 1,
    start_date: "",
    end_date: "",
    positioning: true,
    positioningType,
  };
}

function getRouteNights(routeItem, routeIndex, routeList = []) {
  if (!routeItem?.start_date || routeItem?.positioning) return 0;

  const nextRoute = routeList[routeIndex + 1];
  if (!nextRoute?.start_date || nextRoute?.positioning) return 0;

  const start = new Date(routeItem.start_date);
  const nextStart = new Date(nextRoute.start_date);

  if (Number.isNaN(start.getTime()) || Number.isNaN(nextStart.getTime())) return 0;

  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);

  const nextStartDay = new Date(nextStart);
  nextStartDay.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((nextStartDay - startDay) / 86400000));
}

function calculatePrice(routeItem, routeIndex = 0, routeList = []) {
  const aircraft = getAircraftById(getRouteAircraftId(routeItem));
  const from = findAirportForRoute(routeItem, "from");
  const to = findAirportForRoute(routeItem, "to");

  if (!aircraft) {
    return {
      ready: false,
      reason: "missing_aircraft",
      flightCost: 0,
      overnightCost: 0,
      operationalCost: 0,
      nights: 0,
      total: 0,
      hours: 0,
      miles: 0,
    };
  }

  if (!from || !to) {
    return {
      ready: false,
      reason: "missing_route_data",
      flightCost: 0,
      overnightCost: 0,
      operationalCost: 0,
      nights: 0,
      total: 0,
      hours: 0,
      miles: 0,
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
      reason: "missing_airport_coordinates",
      flightCost: 0,
      overnightCost: 0,
      operationalCost: 0,
      nights: 0,
      total: 0,
      hours: 0,
      miles: 0,
    };
  }

  const distanceNm = getDistanceNM(fromLat, fromLng, toLat, toLng);
  const speed = getAircraftCruiseSpeed(aircraft);

  if (!speed || speed <= 0) {
    return {
      ready: false,
      reason: "missing_aircraft_speed",
      flightCost: 0,
      overnightCost: 0,
      operationalCost: 0,
      nights: 0,
      total: 0,
      hours: 0,
      miles: 0,
    };
  }

  const pricingDefaults = getAircraftPricingDefaults(aircraft);
  const flightTime = calcularTiempoVuelo({
    distanciaNm: distanceNm,
    velocidadKnots: speed,
    aircraftType: aircraft.aircraft_type || aircraft.type,
    margenOperativoMin: pricingDefaults.operationalMarginMinutes,
  });
  const airTime = flightTime.baseDecimalHours;
  const hours = flightTime.estimatedDecimalHours;
  const flightCostRaw = hours * getAircraftRentalRate(aircraft);
  const flightCost = Number(flightCostRaw.toFixed(2));
  const nights = getRouteNights(routeItem, routeIndex, routeList);
  const overnightCost = Number((nights * pricingDefaults.overnightFeeUsd).toFixed(2));
  const operationalCost = pricingDefaults.airportFeesUsd;
  const total = Number((flightCost + overnightCost).toFixed(2));

  return {
    ready: true,
    reason: "",
    flightCost,
    flightCostRaw,
    overnightCost,
    operationalCost,
    nights,
    total,
    airTime: Number(airTime.toFixed(4)),
    hours,
    marginMinutes: flightTime.margenOperativoMin,
    baseMinutes: flightTime.baseMinutes,
    estimatedMinutes: flightTime.estimatedMinutes,
    miles: Number(distanceNm.toFixed(1)),
  };
}

const validRoutes = computed(() =>
  routes.value.filter(
    (routeItem) =>
      Number(routeItem.passengers) > 0 &&
      getRouteAircraftId(routeItem) &&
      routeItem.fromAirport &&
      routeItem.toAirport &&
      norm(routeItem.fromAirport) !== norm(routeItem.toAirport),
  ),
);

const priceBreakdowns = computed(() =>
  validRoutes.value.map((routeItem, index, routeList) =>
    calculatePrice(routeItem, index, routeList),
  ),
);

const pricedRoutes = computed(() => {
  if (!validRoutes.value.length) return [];

  const firstRoute = validRoutes.value[0];
  const lastRoute = validRoutes.value[validRoutes.value.length - 1];
  const aircraftId = firstRoute?.aircraft_id;
  const aircraftBase = getAircraftBaseAirport(aircraftId);
  const firstRouteOrigin = findAirportForRoute(firstRoute, "from");
  const lastRouteDestination = findAirportForRoute(lastRoute, "to");

  if (!aircraftBase) {
    return [...validRoutes.value];
  }
  if (itineraryStartsAndEndsAtBase(validRoutes.value, aircraftBase)) {
    return [...validRoutes.value];
  }

  const calculatedRoutes = [];

  if (!isRouteEndpointAtBase(firstRoute, "from", aircraftBase)) {
    calculatedRoutes.push(
      buildPositioningRoute(
        aircraftId,
        aircraftBase,
        firstRouteOrigin || firstRoute.fromAirport,
        "repositioning",
      ),
    );
  }

  calculatedRoutes.push(...validRoutes.value);

  if (!isRouteEndpointAtBase(lastRoute, "to", aircraftBase)) {
    calculatedRoutes.push(
      buildPositioningRoute(
        aircraftId,
        lastRouteDestination || lastRoute.toAirport,
        aircraftBase,
        "return_to_base",
      ),
    );
  }

  return calculatedRoutes;
});

const pricedBreakdowns = computed(() =>
  pricedRoutes.value.map((routeItem, index, routeList) =>
    calculatePrice(routeItem, index, routeList),
  ),
);

function summarizeRouteBreakdowns(routeItems, breakdownItems) {
  return routeItems.reduce(
    (summary, routeItem, index) => {
      const breakdown = breakdownItems[index];
      if (!breakdown?.ready) return summary;

      summary.miles += toNumber(breakdown.miles);
      summary.flightTime += toNumber(breakdown.airTime);
      summary.estimatedHours += toNumber(breakdown.hours);
      summary.flightTimeMinutes += toNumber(breakdown.baseMinutes);
      summary.estimatedMinutes += toNumber(breakdown.estimatedMinutes);
      summary.flightCost += toNumber(
        breakdown.flightCostRaw ?? breakdown.flightCost,
      );

      if (routeItem?.positioning) {
        summary.positioningCount += 1;
      } else {
        summary.customerCount += 1;
      }

      return summary;
    },
    {
      miles: 0,
      flightTime: 0,
      estimatedHours: 0,
      flightTimeMinutes: 0,
      estimatedMinutes: 0,
      flightCost: 0,
      customerCount: 0,
      positioningCount: 0,
    },
  );
}

const pricingSummary = computed(() => {
  const customerRoutes = pricedRoutes.value.filter((routeItem) => !routeItem.positioning);
  const ferryRoutes = pricedRoutes.value.filter((routeItem) => routeItem.positioning);
  const customerBreakdowns = pricedBreakdowns.value.filter(
    (_, index) => !pricedRoutes.value[index]?.positioning,
  );
  const ferryBreakdowns = pricedBreakdowns.value.filter(
    (_, index) => pricedRoutes.value[index]?.positioning,
  );

  const customer = summarizeRouteBreakdowns(customerRoutes, customerBreakdowns);
  const ferry = summarizeRouteBreakdowns(ferryRoutes, ferryBreakdowns);

  return {
    customer: {
      ...customer,
      miles: Number(customer.miles.toFixed(1)),
      flightTime: Number(customer.flightTime.toFixed(2)),
      estimatedHours: Number(customer.estimatedHours.toFixed(2)),
      flightCost: Number(customer.flightCost.toFixed(2)),
    },
    ferry: {
      ...ferry,
      miles: Number(ferry.miles.toFixed(1)),
      flightTime: Number(ferry.flightTime.toFixed(2)),
      estimatedHours: Number(ferry.estimatedHours.toFixed(2)),
      flightCost: Number(ferry.flightCost.toFixed(2)),
    },
    totals: {
      miles: Number((customer.miles + ferry.miles).toFixed(1)),
      flightTime: Number((customer.flightTime + ferry.flightTime).toFixed(2)),
      estimatedHours: Number(
        (customer.estimatedHours + ferry.estimatedHours).toFixed(2),
      ),
      flightCost: Number((customer.flightCost + ferry.flightCost).toFixed(2)),
    },
  };
});

const routeSummary = computed(() => {
  const path = [];

  validRoutes.value.forEach((leg, index) => {
    const fromAirport = norm(leg.fromAirport);
    const toAirport = norm(leg.toAirport);

    if (!fromAirport || !toAirport) return;

    if (index === 0) {
      path.push(fromAirport, toAirport);
      return;
    }

    if (path[path.length - 1] !== fromAirport) {
      path.push(fromAirport);
    }

    path.push(toAirport);
  });

  return path.join("-");
});

const flightCostTotal = computed(() => pricingSummary.value.totals.flightCost);
const repositioningStartCost = computed(() =>
  Number(
    pricedRoutes.value
      .map((routeItem, index) => ({
        routeItem,
        breakdown: pricedBreakdowns.value[index],
      }))
      .filter(({ routeItem }) => routeItem.positioningType === "repositioning")
      .reduce((sum, item) => sum + toNumber(item.breakdown?.flightCost), 0)
      .toFixed(2),
  ),
);
const returnToBaseCost = computed(() =>
  Number(
    pricedRoutes.value
      .map((routeItem, index) => ({
        routeItem,
        breakdown: pricedBreakdowns.value[index],
      }))
      .filter(({ routeItem }) => routeItem.positioningType === "return_to_base")
      .reduce((sum, item) => sum + toNumber(item.breakdown?.flightCost), 0)
      .toFixed(2),
  ),
);
const overnightTotal = computed(() =>
  Number(
    priceBreakdowns.value
      .reduce((sum, breakdown) => sum + toNumber(breakdown?.overnightCost), 0)
      .toFixed(2),
  ),
);
const otherCharges = computed(() => {
  const aircraft = selectedAircraft.value;
  if (!aircraft) return OTHER_CHARGES_DEFAULT;
  return getAircraftPricingDefaults(aircraft).otherChargesUsd;
});
const operationalExpenses = computed(() => {
  const aircraft = selectedAircraft.value;
  if (!aircraft) return 0;
  return getAircraftPricingDefaults(aircraft).airportFeesUsd;
});
const applyCommercialMargin = computed(() => {
  const aircraft = selectedAircraft.value;
  return Boolean(getAircraftPricingDefaults(aircraft).applyCommercialMargin);
});
const commercialMarginPercent = computed(() => {
  const aircraft = selectedAircraft.value;
  return getAircraftPricingDefaults(aircraft).commercialMarginPercent;
});
const subtotal = computed(
  () =>
    flightCostTotal.value +
    overnightTotal.value +
    operationalExpenses.value +
    otherCharges.value,
);
const commercialMargin = computed(() =>
  applyCommercialMargin.value
    ? Number(
        (
          subtotal.value *
          (commercialMarginPercent.value / 100)
        ).toFixed(2),
      )
    : 0,
);
const iva = computed(() => 0);
const totalFinal = computed(() =>
  Number((subtotal.value + commercialMargin.value).toFixed(2)),
);
const exchangeRate = computed(() => DEFAULT_EXCHANGE_RATE);
const totalMxn = computed(() =>
  Number((totalFinal.value * exchangeRate.value).toFixed(2)),
);
const isInternationalOperation = computed(() =>
  validRoutes.value.some((routeItem) => {
    const from = findAirportForRoute(routeItem, "from");
    const to = findAirportForRoute(routeItem, "to");

    if (!from || !to) return false;
    return norm(from.country) !== norm(to.country);
  }),
);

const breakdownError = computed(() => {
  const invalidBreakdown = pricedBreakdowns.value.find((item) => !item.ready);
  if (!invalidBreakdown) return "";

  const selectedName = selectedAircraft.value?.name || "la aeronave seleccionada";
  const reasons = {
    missing_aircraft: "No se pudo generar la cotizacion porque falta seleccionar una aeronave.",
    missing_route_data:
      "No se pudo generar la cotizacion porque falta relacionar un aeropuerto de origen o destino con la ruta seleccionada.",
    missing_airport_coordinates:
      "No se pudo generar la cotizacion porque uno de los aeropuertos seleccionados no tiene coordenadas configuradas.",
    missing_aircraft_speed: `No se pudo generar la cotizacion porque ${selectedName} no tiene velocidad configurada.`,
  };

  return reasons[invalidBreakdown.reason] || "No se pudo generar la cotizacion con la configuracion actual.";
});

function addRoute() {
  const last = routes.value[routes.value.length - 1] || emptyRoute();
  routes.value.push({
    ...emptyRoute(),
    fromAirport: last.toAirport || "",
    fromCity: last.toCity || "",
    fromState: last.toState || "",
    fromCountry: last.toCountry || "",
    passengers: last.passengers || 1,
    aircraft_id: selectedAircraftId.value || null,
  });
}

function removeRoute(index) {
  if (routes.value.length === 1) return;
  routes.value.splice(index, 1);
}

function handleRouteAirportChange(routeItem, direction, event) {
  assignAirportToRoute(routeItem, direction, event.target.value);
}

function handleCalculate() {
  if (!selectedAircraftId.value) {
    feedback.warning("Selecciona una aeronave", "Elige una aeronave para calcular.");
    return;
  }
  if (!validRoutes.value.length) {
    feedback.warning("Rutas incompletas", "Captura al menos una ruta valida con origen y destino.");
    return;
  }
  if (breakdownError.value) {
    feedback.error("No se pudo calcular", breakdownError.value);
    return;
  }

  hasCalculated.value = true;
  feedback.notify("Cotizador actualizado", "success");
}

function buildAirportSnapshot(airportCode) {
  const airport = findAirportForCode(airportCode);

  return {
    iata: norm(getAirportOptionValue(airport) || airportCode),
    icao: airport?.icao || airport?.ICAO || null,
    airport_name: airport?.aeropuerto || null,
    city: airport?.ciudad || null,
    country: airport?.country || null,
    latitude: airport?.lat == null ? null : Number(airport.lat),
    longitude: airport?.lng == null ? null : Number(airport.lng),
  };
}

function buildPdfBreakdownRows() {
  return [
    { label: "Flight Cost", value: Number(flightCostTotal.value.toFixed(2)) },
    { label: "Overnight Crew", value: Number(overnightTotal.value.toFixed(2)) },
    { label: "Operational Expenses", value: Number(operationalExpenses.value.toFixed(2)) },
  ];
}

function buildCalculationSnapshot() {
  return {
    billableLegs: pricedRoutes.value.map((routeItem, index) => {
      const breakdown = pricedBreakdowns.value[index];

      return {
        id: routeItem.id || `leg-${index + 1}`,
        leg_order: index + 1,
        leg_type: routeItem.positioning ? routeItem.positioningType || "positioning" : "client",
        visible_to_client: !routeItem.positioning,
        from_iata: norm(routeItem.fromAirport),
        to_iata: norm(routeItem.toAirport),
        from_airport: norm(routeItem.fromAirport),
        to_airport: norm(routeItem.toAirport),
        passengers: Number(routeItem.passengers || 1),
        positioning: Boolean(routeItem.positioning),
        positioningType: routeItem.positioningType || null,
        miles: Number(breakdown?.miles || 0),
        distance_nm: Number(breakdown?.miles || 0),
        billable_hours: Number(breakdown?.hours || 0),
        estimatedHours: Number(breakdown?.hours || 0),
        amount_usd: Number(breakdown?.flightCost || 0),
        flightCost: Number(breakdown?.flightCost || 0),
        estimatedMinutes: Number(breakdown?.estimatedMinutes || 0),
      };
    }),
    pdfBreakdownRows: buildPdfBreakdownRows(),
    pdfTotals: {
      client_flight_hours: Number(pricingSummary.value.customer.estimatedHours.toFixed(2)),
      hourly_rate_usd: Number(getAircraftRentalRate(selectedAircraft.value).toFixed(2)),
      flight_cost_usd: Number(flightCostTotal.value.toFixed(2)),
      repositioning_cost_usd: Number(repositioningStartCost.value.toFixed(2)),
      return_to_base_cost_usd: Number(returnToBaseCost.value.toFixed(2)),
      overnight_cost_usd: Number(overnightTotal.value.toFixed(2)),
      operational_expenses_usd: Number(operationalExpenses.value.toFixed(2)),
      tax_amount_usd: 0,
      total_usd: Number(totalFinal.value.toFixed(2)),
      exchange_rate: Number(exchangeRate.value.toFixed(4)),
      total_mxn: Number(totalMxn.value.toFixed(2)),
      show_total_mxn: true,
    },
    pricingSummary: pricingSummary.value,
    show_mxn_in_pdf: true,
  };
}

function buildFlightQuotePayload(userId = null) {
  const aircraft = selectedAircraft.value;

  if (!aircraft) {
    throw new Error("Selecciona una aeronave antes de guardar.");
  }

  const formatLocalDateTime = (value) => {
    if (!value) return null;

    const normalized = String(value).trim();
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
  };

  return {
    quote_number: generateQuoteNumber(),
    status: "calculated",
    client_name: "A QUIEN CORRESPONDA",
    client_email: null,
    client_phone: null,
    flight_type: "Private Jet",
    quote_mode: "complete",
    time_mode: "block_time",
    operation_type: isInternationalOperation.value ? "international" : "national",
    aircraft_id: aircraft.id,
    aircraft_name: aircraft.name || null,
    aircraft_tail:
      aircraft.tail_number ||
      aircraft.registration ||
      aircraft.matricula ||
      aircraft.tail ||
      null,
    aircraft_capacity: aircraft.capacity_passengers || null,
    aircraft_base: aircraft.home_base || aircraft.base || aircraft.iata || null,
    departure_at: formatLocalDateTime(validRoutes.value[0]?.start_date),
    return_at: formatLocalDateTime(
      validRoutes.value[validRoutes.value.length - 1]?.end_date ||
        validRoutes.value[validRoutes.value.length - 1]?.start_date,
    ),
    passengers: Number(validRoutes.value[0]?.passengers || 1),
    route_summary: routeSummary.value,
    total_distance_nm: Number(pricingSummary.value.totals.miles.toFixed(2)),
    client_flight_hours: Number(pricingSummary.value.customer.estimatedHours.toFixed(2)),
    billable_hours: Number(pricingSummary.value.totals.estimatedHours.toFixed(2)),
    hourly_rate_usd: Number(getAircraftRentalRate(aircraft).toFixed(2)),
    flight_cost_usd: Number(flightCostTotal.value.toFixed(2)),
    repositioning_cost_usd: Number(repositioningStartCost.value.toFixed(2)),
    return_to_base_cost_usd: Number(returnToBaseCost.value.toFixed(2)),
    overnight_cost_usd: Number(overnightTotal.value.toFixed(2)),
    operational_expenses_usd: Number(operationalExpenses.value.toFixed(2)),
    subtotal_usd: Number(subtotal.value.toFixed(2)),
    tax_rate: 0,
    tax_amount_usd: 0,
    total_usd: Number(totalFinal.value.toFixed(2)),
    exchange_rate: Number(exchangeRate.value.toFixed(4)),
    total_mxn: Number(totalMxn.value.toFixed(2)),
    notes: null,
    calculation_version: "web-reserva-v1",
    calculation_snapshot: buildCalculationSnapshot(),
    created_by: userId,
  };
}

function buildFlightQuoteLegPayloads(quoteId) {
  return pricedRoutes.value.map((routeItem, index) => {
    const breakdown = pricedBreakdowns.value[index];
    const from = buildAirportSnapshot(routeItem.fromAirport);
    const to = buildAirportSnapshot(routeItem.toAirport);

    return {
      quote_id: quoteId,
      leg_order: index + 1,
      leg_type: routeItem.positioning ? routeItem.positioningType || "positioning" : "client",
      visible_to_client: !routeItem.positioning,
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
      distance_nm: Number(breakdown?.miles || 0),
      cruise_speed_knots: Number(getAircraftCruiseSpeed(selectedAircraft.value) || 0),
      estimated_air_time: Number(breakdown?.airTime || 0),
      block_time: Number(breakdown?.hours || 0),
      billable_hours: Number(breakdown?.hours || 0),
      minimum_hours_applied: false,
      minimum_hours: 0,
      hourly_rate_usd: Number(getAircraftRentalRate(selectedAircraft.value).toFixed(2)),
      amount_usd: Number(breakdown?.flightCost || 0),
      passengers: Number(routeItem.passengers || 1),
    };
  });
}

async function handleSaveAndOpenPdf() {
  if (!hasCalculated.value) {
    handleCalculate();
  }

  if (!hasCalculated.value || breakdownError.value) return;

  saving.value = true;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;
    const quotePayload = buildFlightQuotePayload(userId);
    const { data: quote, error: quoteError } = await supabase
      .from("flight_quotes")
      .insert(quotePayload)
      .select("id, quote_number")
      .single();

    if (quoteError) throw quoteError;

    const legsPayload = buildFlightQuoteLegPayloads(quote.id);

    if (legsPayload.length) {
      const { error: legsError } = await supabase
        .from("flight_quote_legs")
        .insert(legsPayload);

      if (legsError) throw legsError;
    }

    feedback.notify(`Cotizacion guardada ${quote.quote_number || ""}`.trim(), "success");
    await router.push({
      name: "AdminQuotes",
      query: { pdf: quote.id },
    });
  } catch (error) {
    console.error("Unable to save web calculator quote", error);
    feedback.error("No se pudo guardar la cotizacion", error);
  } finally {
    saving.value = false;
  }
}

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
      iata: norm(airport.IATA || airport.iata),
      icao: airport.ICAO || airport.icao || null,
      ciudad: airport.CIUDAD,
      estado: airport.ESTADO,
      country: "MEXICO",
      lat: airport.LATITUDE,
      lng: airport.LONGITUDE,
    }));

    const internationalAirports = (international || []).map((airport) => ({
      aeropuerto: airport.AEROPUERTO,
      iata: norm(airport.IATA || airport.iata),
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
    console.error("Unable to load calculator catalogs", error);
    feedback.error("No se pudieron cargar catalogos", error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => selectedAircraftId.value,
  (aircraftId) => {
    routes.value.forEach((routeItem) => {
      routeItem.aircraft_id = aircraftId || null;
    });
  },
);

watch(
  [routes, selectedAircraftId],
  () => {
    hasCalculated.value = false;
  },
  { deep: true },
);

onMounted(async () => {
  await loadCatalogs();
});
</script>

<template>
  <section class="page-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Espacio de cotizaciones</p>
        <h1>Cotizador web</h1>
        <p class="subtitle">
          Replica interna de la logica del landing `Reserva.vue`: vuelo del cliente,
          posicionamiento, pernocta, cargos operativos, otros cargos y margen comercial.
        </p>
      </div>

      <div class="hero-badge">
        <span>{{ pricedRoutes.length }}</span>
        <small>{{ pricedRoutes.length === 1 ? "tramo cobrable" : "tramos cobrables" }}</small>
      </div>
    </header>

    <div v-if="loading" class="state-card">Cargando catalogos operativos...</div>

    <div v-else class="layout-grid">
      <form class="editor-card" @submit.prevent="handleCalculate">
        <section class="section-block">
          <div class="section-head">
            <h2>Operacion</h2>
            <button type="button" class="ghost-btn" @click="addRoute">Agregar tramo</button>
          </div>

          <div class="form-grid two-columns">
            <label class="field">
              <span>Aeronave</span>
              <select v-model="routes[0].aircraft_id">
                <option :value="null">Selecciona una aeronave</option>
                <option v-for="aircraft in filteredFleet" :key="aircraft.id" :value="aircraft.id">
                  {{ getAircraftOptionLabel(aircraft) }}
                </option>
              </select>
            </label>

            <div class="summary-tile">
              <strong>{{ selectedAircraft?.name || "Sin aeronave" }}</strong>
              <span>
                {{ selectedAircraft?.aircraft_type || selectedAircraft?.type || "Selecciona una opcion" }}
              </span>
              <span v-if="selectedAircraft">
                {{ selectedAircraft.capacity_passengers || "-" }} pax · {{ selectedAircraft.home_base || selectedAircraft.base || selectedAircraft.iata || "-" }}
              </span>
              <span v-if="selectedAircraft">
                {{ getAircraftCostSummary(selectedAircraft) }}
              </span>
            </div>
          </div>

          <div v-if="hasLongHelicopterLeg" class="notice-card warning">
            La ruta incluye un tramo mayor a {{ HELICOPTER_MAX_LEG_DISTANCE_NM }} NM.
            El filtro excluye helicopteros para respetar la misma regla del landing.
          </div>
        </section>

        <section class="section-block">
          <div class="section-head">
            <h2>Rutas del cliente</h2>
          </div>

          <div
            v-for="(routeItem, index) in routes"
            :key="routeItem.id"
            class="route-card"
          >
            <div class="route-card__head">
              <strong>Tramo {{ index + 1 }}</strong>
              <button
                v-if="routes.length > 1"
                type="button"
                class="link-btn"
                @click="removeRoute(index)"
              >
                Quitar
              </button>
            </div>

            <div class="form-grid route-grid">
              <label class="field">
                <span>Origen</span>
                <input
                  :value="routeItem.fromAirport"
                  :list="`airport-options-${index}`"
                  type="search"
                  placeholder="Busca o captura un aeropuerto"
                  @input="handleRouteAirportChange(routeItem, 'from', $event)"
                  @change="handleRouteAirportChange(routeItem, 'from', $event)"
                />
              </label>

              <label class="field">
                <span>Destino</span>
                <input
                  :value="routeItem.toAirport"
                  :list="`airport-options-${index}`"
                  type="search"
                  placeholder="Busca o captura un aeropuerto"
                  @input="handleRouteAirportChange(routeItem, 'to', $event)"
                  @change="handleRouteAirportChange(routeItem, 'to', $event)"
                />
              </label>

              <label class="field">
                <span>Fecha de salida</span>
                <input v-model="routeItem.start_date" type="datetime-local" />
              </label>

              <label class="field">
                <span>Fecha fin</span>
                <input v-model="routeItem.end_date" type="datetime-local" />
              </label>

              <label class="field">
                <span>Pasajeros</span>
                <input v-model.number="routeItem.passengers" type="number" min="1" max="19" />
              </label>

              <div class="mini-summary">
                <span>{{ routeItem.fromAirport || "-" }} -> {{ routeItem.toAirport || "-" }}</span>
                <strong>
                  {{ getRouteLegDistanceNm(routeItem) ? `${getRouteLegDistanceNm(routeItem).toFixed(1)} NM` : "Sin distancia" }}
                </strong>
              </div>
            </div>

            <datalist :id="`airport-options-${index}`">
              <option
                v-for="airport in airportOptions"
                :key="`${index}-${getAirportOptionValue(airport)}-${airport.aeropuerto}`"
                :value="getAirportOptionValue(airport)"
              >
                {{ getAirportOptionLabel(airport) }}
              </option>
            </datalist>
          </div>
        </section>

        <div v-if="breakdownError" class="notice-card error">
          {{ breakdownError }}
        </div>

        <div class="action-row">
          <button class="primary-btn" type="submit">Calcular con formula web</button>
          <button
            class="secondary-btn"
            type="button"
            :disabled="saving || !selectedAircraftId || !validRoutes.length"
            @click="handleSaveAndOpenPdf"
          >
            {{ saving ? "Guardando..." : "Guardar y abrir PDF admin" }}
          </button>
        </div>
      </form>

      <aside class="preview-card">
        <div class="preview-head">
          <div>
            <p class="eyebrow">Resultado</p>
            <h2>Desglose web</h2>
          </div>
          <span class="result-pill" :class="{ ready: hasCalculated && !breakdownError }">
            {{ hasCalculated && !breakdownError ? "Calculado" : "Pendiente" }}
          </span>
        </div>

        <div class="stats-grid">
          <article class="stat-item">
            <span>Vuelo cliente</span>
            <strong>{{ formatCurrency(pricingSummary.customer.flightCost) }}</strong>
          </article>
          <article class="stat-item">
            <span>Reposicionamiento</span>
            <strong>{{ formatCurrency(pricingSummary.ferry.flightCost) }}</strong>
          </article>
          <article class="stat-item">
            <span>Pernocta</span>
            <strong>{{ formatCurrency(overnightTotal) }}</strong>
          </article>
          <article class="stat-item">
            <span>Gastos operativos</span>
            <strong>{{ formatCurrency(operationalExpenses) }}</strong>
          </article>
          <article class="stat-item">
            <span>Otros cargos</span>
            <strong>{{ formatCurrency(otherCharges) }}</strong>
          </article>
          <article class="stat-item">
            <span>Margen comercial</span>
            <strong>{{ formatCurrency(commercialMargin) }}</strong>
          </article>
        </div>

        <div class="totals-card">
          <div><span>Millas totales</span><strong>{{ pricingSummary.totals.miles.toFixed(1) }} NM</strong></div>
          <div><span>Tiempo real</span><strong>{{ formatHours(pricingSummary.customer.flightTime * 60) }}</strong></div>
          <div><span>Tiempo estimado</span><strong>{{ formatHours(pricingSummary.totals.estimatedHours * 60) }}</strong></div>
          <div><span>Subtotal</span><strong>{{ formatCurrency(subtotal) }}</strong></div>
          <div><span>IVA</span><strong>{{ formatCurrency(iva) }}</strong></div>
          <div class="grand-total"><span>Total final</span><strong>{{ formatCurrency(totalFinal) }}</strong></div>
        </div>

        <div class="logic-note">
          Esta vista sigue la misma formula del landing:
          `flight cost + overnight + airportFeesUsd + otherChargesUsd + margen comercial`.
          El IVA queda en `0`, igual que en `Reserva.vue`.
        </div>

        <section class="legs-section">
          <div class="legs-head">
            <h3>Tramos cobrables</h3>
            <small>{{ pricedRoutes.length }} total</small>
          </div>

          <article
            v-for="(routeItem, index) in pricedRoutes"
            :key="routeItem.id || `${routeItem.fromAirport}-${routeItem.toAirport}-${index}`"
            class="leg-item"
          >
            <div class="leg-item__top">
              <strong>{{ routeItem.fromAirport }} -> {{ routeItem.toAirport }}</strong>
              <span class="tag" :class="{ positioning: routeItem.positioning }">
                {{ routeItem.positioning ? routeItem.positioningType : "client" }}
              </span>
            </div>

            <div class="leg-metrics">
              <span>{{ pricedBreakdowns[index]?.miles?.toFixed(1) || "0.0" }} NM</span>
              <span>{{ formatHours(pricedBreakdowns[index]?.estimatedMinutes || 0) }}</span>
              <span>{{ formatCurrency(pricedBreakdowns[index]?.flightCost || 0) }}</span>
            </div>

            <div class="leg-submetrics">
              <span>Margen operativo: {{ pricedBreakdowns[index]?.marginMinutes || 0 }} min</span>
              <span>Noches: {{ pricedBreakdowns[index]?.nights || 0 }}</span>
              <span>Pernocta: {{ formatCurrency(pricedBreakdowns[index]?.overnightCost || 0) }}</span>
            </div>
          </article>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.page-shell {
  display: grid;
  gap: 24px;
}

.hero,
.editor-card,
.preview-card,
.state-card {
  border: 1px solid var(--border-color);
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(15, 95, 166, 0.08), transparent 28%),
    linear-gradient(180deg, var(--bg-surface-solid), var(--bg-soft));
  box-shadow: var(--shadow-md);
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 28px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero h1,
.preview-head h2,
.section-head h2 {
  margin: 0;
  color: var(--text-strong);
}

.subtitle {
  max-width: 760px;
  margin: 12px 0 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.hero-badge {
  min-width: 150px;
  display: grid;
  align-content: center;
  justify-items: center;
  padding: 18px;
  border-radius: 22px;
  background: rgba(15, 95, 166, 0.08);
}

.hero-badge span {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary);
}

.hero-badge small {
  color: var(--text-muted);
}

.layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
  gap: 24px;
  align-items: start;
}

.editor-card,
.preview-card,
.state-card {
  padding: 24px;
}

.section-block + .section-block {
  margin-top: 24px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.form-grid {
  display: grid;
  gap: 16px;
}

.two-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.route-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 8px;
}

.field span,
.stat-item span,
.totals-card span,
.mini-summary span,
.leg-submetrics span,
.logic-note {
  color: var(--text-muted);
  font-size: 0.92rem;
}

.field input,
.field select,
.ghost-btn,
.primary-btn {
  min-height: 46px;
  border-radius: 14px;
}

.field input,
.field select {
  width: 100%;
  padding: 0 14px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  color: var(--text-strong);
}

.field input[type="search"]::-webkit-search-cancel-button,
.field input[type="search"]::-webkit-search-decoration {
  -webkit-appearance: none;
}

.summary-tile,
.route-card,
.notice-card,
.stat-item,
.totals-card,
.leg-item,
.mini-summary {
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.summary-tile,
.mini-summary {
  display: grid;
  gap: 6px;
  padding: 16px;
}

.route-card {
  padding: 18px;
}

.route-card + .route-card {
  margin-top: 14px;
}

.route-card__head,
.preview-head,
.legs-head,
.leg-item__top,
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mini-summary {
  align-content: center;
}

.notice-card {
  margin-top: 16px;
  padding: 14px 16px;
}

.notice-card.warning {
  border-color: rgba(182, 117, 0, 0.25);
  background: rgba(255, 239, 204, 0.7);
}

.notice-card.error {
  border-color: rgba(190, 54, 54, 0.18);
  background: rgba(255, 235, 235, 0.9);
  color: #8a1f1f;
}

.ghost-btn,
.primary-btn,
.secondary-btn,
.link-btn {
  border: 0;
  cursor: pointer;
  font-weight: 700;
}

.ghost-btn {
  padding: 0 16px;
  background: rgba(15, 95, 166, 0.1);
  color: var(--primary);
}

.primary-btn {
  padding: 0 18px;
  background: linear-gradient(135deg, #0f5fa6 0%, #0b4c86 100%);
  color: white;
}

.secondary-btn {
  min-height: 46px;
  padding: 0 18px;
  border-radius: 14px;
  background: rgba(15, 95, 166, 0.1);
  color: var(--primary);
}

.secondary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.link-btn {
  background: transparent;
  color: #b42318;
}

.preview-card {
  display: grid;
  gap: 18px;
  position: sticky;
  top: 24px;
}

.result-pill {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(145, 158, 171, 0.12);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.result-pill.ready {
  background: rgba(18, 183, 106, 0.14);
  color: #067647;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stat-item,
.totals-card,
.leg-item {
  padding: 16px;
}

.stat-item strong,
.totals-card strong,
.leg-item strong,
.summary-tile strong,
.mini-summary strong {
  color: var(--text-strong);
}

.totals-card {
  display: grid;
  gap: 12px;
}

.totals-card > div,
.leg-metrics,
.leg-submetrics {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.grand-total {
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.grand-total strong {
  color: var(--primary);
  font-size: 1.2rem;
}

.logic-note {
  line-height: 1.6;
}

.legs-section {
  display: grid;
  gap: 12px;
}

.tag {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 95, 166, 0.1);
  color: var(--primary);
  font-size: 0.8rem;
  font-weight: 700;
}

.tag.positioning {
  background: rgba(202, 169, 106, 0.18);
  color: #8a6116;
}

.leg-item {
  display: grid;
  gap: 10px;
}

@media (max-width: 1100px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .preview-card {
    position: static;
  }
}

@media (max-width: 820px) {
  .hero,
  .two-columns,
  .route-grid,
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    display: grid;
  }
}
</style>
