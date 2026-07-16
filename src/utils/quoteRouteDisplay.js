const EMPTY_VALUE = "-";

function normalizeAirportCode(value) {
  return String(value || "").trim().toUpperCase();
}

function getSavedFlightQuoteLegs(quote) {
  const legs = Array.isArray(quote?.flight_quote_legs) ? [...quote.flight_quote_legs] : [];

  return legs
    .sort((left, right) => Number(left?.leg_order || 0) - Number(right?.leg_order || 0))
    .map((leg, index) => {
      const legType = String(leg?.leg_type || "").toLowerCase();
      const isReturnToBase = legType === "return_to_base";
      const isPositioning =
        legType === "positioning" || legType === "repositioning" || isReturnToBase;

      return {
        id: leg?.id || `saved-leg-${index}`,
        from_airport: normalizeAirportCode(leg?.from_iata || leg?.from_icao),
        from_airport_name: String(leg?.from_airport_name || "").trim(),
        to_airport: normalizeAirportCode(leg?.to_iata || leg?.to_icao),
        to_airport_name: String(leg?.to_airport_name || "").trim(),
        aircraft_id: quote?.aircraft_id || null,
        aircraft_fleet: {
          name: quote?.aircraft_name || EMPTY_VALUE,
        },
        passengers: leg?.passengers || quote?.passengers || null,
        positioning: isPositioning,
        positioningLabel: isReturnToBase ? "Regreso a base" : "Reposicionamiento",
      };
    })
    .filter((leg) => leg.from_airport && leg.to_airport);
}

function getSnapshotLegs(quote) {
  const snapshotLegs =
    quote?.calculation_snapshot?.billableLegs ||
    quote?.calculation_snapshot?.billableRoutes ||
    quote?.calculation_snapshot?.legs ||
    [];

  if (!Array.isArray(snapshotLegs) || !snapshotLegs.length) return [];

  return snapshotLegs
    .map((leg, index) => {
      const legType = String(leg?.leg_type || leg?.positioningType || "").toLowerCase();
      const isReturnToBase = legType === "return_to_base";
      const isPositioning =
        legType === "positioning" || legType === "repositioning" || isReturnToBase;

      return {
        id: leg?.id || `snapshot-leg-${index}`,
        from_airport: normalizeAirportCode(
          leg?.from_airport || leg?.from_iata || leg?.from,
        ),
        to_airport: normalizeAirportCode(
          leg?.to_airport || leg?.to_iata || leg?.to,
        ),
        aircraft_id: quote?.aircraft_id || leg?.aircraft_id || null,
        aircraft_fleet: {
          name: quote?.aircraft_name || EMPTY_VALUE,
        },
        passengers: leg?.passengers || quote?.passengers || null,
        positioning: isPositioning,
        positioningLabel: isReturnToBase ? "Regreso a base" : "Reposicionamiento",
      };
    })
    .filter((leg) => leg.from_airport && leg.to_airport);
}

function getRouteSummaryLegs(quote) {
  const codes = String(quote?.route_summary || "")
    .split("-")
    .map((code) => normalizeAirportCode(code))
    .filter(Boolean);

  if (codes.length < 2) return [];

  return codes.slice(0, -1).map((fromAirport, index) => ({
    id: `route-summary-leg-${index}`,
    from_airport: fromAirport,
    to_airport: codes[index + 1],
    aircraft_id: quote?.aircraft_id || null,
    aircraft_fleet: {
      name: quote?.aircraft_name || EMPTY_VALUE,
    },
    passengers: quote?.passengers || null,
    positioning: false,
    positioningLabel: "",
  }));
}

function compareRoutes(left, right) {
  const leftDate = left?.start_date ? new Date(left.start_date).getTime() : 0;
  const rightDate = right?.start_date ? new Date(right.start_date).getTime() : 0;

  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function isSameAirport(left, right) {
  return normalizeAirportCode(left) && normalizeAirportCode(left) === normalizeAirportCode(right);
}

function getBaseAirportCode(route) {
  const baseCode = route?.aircraft_fleet?.iata || route?.aircraft_fleet?.home_base;
  return String(baseCode || "").trim().toUpperCase();
}

function getFallbackOrderedRoutes(routes) {
  return [...routes].sort(compareRoutes);
}

function getBestNextRoute(currentRoute, remainingRoutes) {
  const currentArrival = normalizeAirportCode(currentRoute?.to_airport);
  if (!currentArrival) return null;

  return remainingRoutes.find(
    (route) => normalizeAirportCode(route?.from_airport) === currentArrival,
  );
}

function getBestStartRoute(routes) {
  const arrivals = new Set(
    routes.map((route) => normalizeAirportCode(route?.to_airport)).filter(Boolean),
  );

  return (
    routes.find((route) => !arrivals.has(normalizeAirportCode(route?.from_airport))) ||
    null
  );
}

export function getOrderedQuoteRoutes(quote) {
  const routes = Array.isArray(quote?.quote_routes) ? [...quote.quote_routes] : [];
  const fallbackRoutes = getFallbackOrderedRoutes(routes);

  if (fallbackRoutes.length <= 1) return fallbackRoutes;

  const orderedRoutes = [];
  const remainingRoutes = [...fallbackRoutes];

  let currentRoute = getBestStartRoute(remainingRoutes) || remainingRoutes[0];

  while (currentRoute) {
    orderedRoutes.push(currentRoute);

    const currentIndex = remainingRoutes.findIndex(
      (route) => String(route?.id || "") === String(currentRoute?.id || ""),
    );

    if (currentIndex >= 0) {
      remainingRoutes.splice(currentIndex, 1);
    }

    currentRoute =
      getBestNextRoute(currentRoute, remainingRoutes) ||
      getBestStartRoute(remainingRoutes) ||
      remainingRoutes[0] ||
      null;
  }

  return orderedRoutes;
}

export function getPrimaryQuoteRoute(quote) {
  return getOrderedQuoteRoutes(quote)[0] || null;
}

export function getFinalQuoteRoute(quote) {
  const routes = getOrderedQuoteRoutes(quote);
  return routes[routes.length - 1] || null;
}

export function getDisplayQuoteLegs(quote) {
  const savedLegs = getSavedFlightQuoteLegs(quote);
  if (savedLegs.length) return savedLegs;

  const snapshotLegs = getSnapshotLegs(quote);
  if (snapshotLegs.length) return snapshotLegs;

  const routes = getOrderedQuoteRoutes(quote);

  if (!routes.length) {
    return getRouteSummaryLegs(quote);
  }

  const firstRoute = routes[0];
  const lastRoute = routes[routes.length - 1];
  const baseAirport = getBaseAirportCode(firstRoute);
  const displayLegs = [];

  if (baseAirport && !isSameAirport(baseAirport, firstRoute?.from_airport)) {
    displayLegs.push({
      id: `positioning-start-${quote?.id || "quote"}`,
      from_airport: baseAirport,
      to_airport: firstRoute?.from_airport || EMPTY_VALUE,
      aircraft_id: firstRoute?.aircraft_id || null,
      aircraft_fleet: firstRoute?.aircraft_fleet || null,
      passengers: firstRoute?.passengers || null,
      positioning: true,
      positioningLabel: "Reposicionamiento",
    });
  }

  routes.forEach((route) => {
    displayLegs.push({
      ...route,
      positioning: false,
      positioningLabel: "",
    });
  });

  if (baseAirport && !isSameAirport(lastRoute?.to_airport, baseAirport)) {
    displayLegs.push({
      id: `positioning-end-${quote?.id || "quote"}`,
      from_airport: lastRoute?.to_airport || EMPTY_VALUE,
      to_airport: baseAirport,
      aircraft_id: lastRoute?.aircraft_id || firstRoute?.aircraft_id || null,
      aircraft_fleet: lastRoute?.aircraft_fleet || firstRoute?.aircraft_fleet || null,
      passengers: lastRoute?.passengers || firstRoute?.passengers || null,
      positioning: true,
      positioningLabel: "Regreso a base",
    });
  }

  return displayLegs;
}

export function getDisplayRoutePath(quote) {
  const legs = getDisplayQuoteLegs(quote);

  if (!legs.length) return EMPTY_VALUE;

  const path = [];

  legs.forEach((leg, index) => {
    const fromAirport = leg?.from_airport || EMPTY_VALUE;
    const toAirport = leg?.to_airport || EMPTY_VALUE;

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
}

export function getDisplayRouteCount(quote) {
  return getDisplayQuoteLegs(quote).length;
}
