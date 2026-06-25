import { supabase } from "@/supabase";

const EMPTY_VALUE = "-";
const EARTH_RADIUS_NM = 3440.065;
const NATIONAL_TABLES = ["aeropuertos_mexico"];

let airportDirectoryPromise = null;
let aircraftDirectoryPromise = null;

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

async function fetchFirstAvailableTable(tables, columns) {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select(columns);

    if (!error) {
      return data || [];
    }
  }

  return [];
}

async function loadAirportDirectory() {
  if (!airportDirectoryPromise) {
    airportDirectoryPromise = (async () => {
      const nationalAirports = await fetchFirstAvailableTable(
        NATIONAL_TABLES,
        "AEROPUERTO, IATA, ICAO, LATITUDE, LONGITUDE",
      );

      const { data: internationalAirports } = await supabase
        .from("airports_geo")
        .select("AEROPUERTO, IATA, ICAO, LATITUDE, LONGITUDE");

      const index = new Map();
      const airports = [...nationalAirports, ...(internationalAirports || [])];

      airports.forEach((airport) => {
        const entry = {
          code: normalizeCode(airport?.IATA || airport?.ICAO || airport?.AEROPUERTO),
          lat: toNumber(airport?.LATITUDE),
          lng: toNumber(airport?.LONGITUDE),
        };

        [airport?.IATA, airport?.ICAO, airport?.AEROPUERTO].forEach((candidate) => {
          const code = normalizeCode(candidate);
          if (code) {
            index.set(code, entry);
          }
        });
      });

      return index;
    })();
  }

  return airportDirectoryPromise;
}

async function loadAircraftDirectory() {
  if (!aircraftDirectoryPromise) {
    aircraftDirectoryPromise = (async () => {
      const { data } = await supabase
        .from("aircraft_fleet")
        .select("id, cruise_speed_knots, cruise_speed, speed_knots, speed");

      const index = new Map();

      (data || []).forEach((aircraft) => {
        const key = String(aircraft?.id || "").trim();
        if (key) {
          index.set(key, aircraft);
        }
      });

      return index;
    })();
  }

  return aircraftDirectoryPromise;
}

function calculateDistanceNm(fromAirport, toAirport) {
  if (!fromAirport || !toAirport) return null;

  const dLat = toRadians(toAirport.lat - fromAirport.lat);
  const dLon = toRadians(toAirport.lng - fromAirport.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromAirport.lat)) *
      Math.cos(toRadians(toAirport.lat)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_NM * c);
}

function getCruiseSpeedKnots(leg, aircraftDirectory) {
  const aircraft =
    aircraftDirectory?.get(String(leg?.aircraft_id || "").trim()) || null;

  return (
    toNumber(leg?.aircraft_fleet?.cruise_speed_knots) ||
    toNumber(leg?.aircraft_fleet?.cruise_speed) ||
    toNumber(leg?.aircraft_fleet?.speed_knots) ||
    toNumber(leg?.aircraft_fleet?.speed) ||
    toNumber(aircraft?.cruise_speed_knots) ||
    toNumber(aircraft?.cruise_speed) ||
    toNumber(aircraft?.speed_knots) ||
    toNumber(aircraft?.speed)
  );
}

function formatDuration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return EMPTY_VALUE;

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

export function getLegMetricKey(leg, index = 0) {
  return String(leg?.id || `${leg?.from_airport || "from"}-${leg?.to_airport || "to"}-${index}`);
}

export async function getQuoteLegMetricsMap(legs) {
  const airportDirectory = await loadAirportDirectory();
  const aircraftDirectory = await loadAircraftDirectory();
  const metricsMap = {};

  legs.forEach((leg, index) => {
    const key = getLegMetricKey(leg, index);
    const fromAirport = airportDirectory.get(normalizeCode(leg?.from_airport));
    const toAirport = airportDirectory.get(normalizeCode(leg?.to_airport));
    const distanceNm = calculateDistanceNm(fromAirport, toAirport);
    const speedKnots = getCruiseSpeedKnots(leg, aircraftDirectory);
    const durationHours =
      distanceNm && speedKnots && speedKnots > 0 ? distanceNm / speedKnots : null;

    metricsMap[key] = {
      distanceNm,
      distanceLabel: Number.isFinite(distanceNm) ? String(distanceNm) : EMPTY_VALUE,
      durationHours,
      durationLabel: formatDuration(durationHours),
    };
  });

  return metricsMap;
}
