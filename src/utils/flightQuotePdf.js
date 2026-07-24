import jsPDF from "jspdf";
import {
  getDisplayQuoteLegs,
  getDisplayRoutePath,
  getPrimaryQuoteRoute,
} from "@/utils/quoteRouteDisplay";
import { getLegMetricKey, getQuoteLegMetricsMap } from "@/utils/quoteLegMetrics";
import {
  getPreferredAircraftName,
  resolveAircraftDisplayName,
} from "@/utils/aircraftDisplay";

const PAGE = {
  width: 210,
  height: 297,
  marginX: 20,
  contentWidth: 170,
  footerY: 287,
};

const FIRST_PAGE_CONTENT_MAX_Y = 278;

const COLORS = {
  ink: [15, 23, 42],
  steel: [71, 85, 105],
  accent: [10, 31, 51],
  navy: [16, 55, 89],
  gold: [190, 137, 62],
  goldSoft: [247, 242, 232],
  accentSoft: [232, 238, 246],
  line: [214, 223, 233],
  panel: [248, 251, 255],
  row: [241, 246, 250],
  white: [255, 255, 255],
};

const TERMS = [
  [
    "USE OF PRIVATE AVIATION SERVICE",
    "The use of the aircraft is strictly limited to private transportation purposes, including family, business, and leisure travel. Any commercial or cargo activities of any kind are expressly prohibited.",
  ],
  [
    "INCLUDED SERVICES",
    "The private jet includes airport fees, fuel, crew fees, a premium minibar, and snacks. This service must be requested in advance by the passenger to ensure proper delivery.",
  ],
  [
    "CAPACITY AND LUGGAGE",
    "The maximum capacity of the aircraft is 6 passengers. Each passenger is permitted one (1) 50-pound bag and one (1) small handbag.",
  ],
  [
    "PAYMENT AND DEPOSIT",
    "The passenger must pay Red Sky Group a deposit of 50% of the total trip cost to secure the private aviation service. The remaining balance must be paid in full prior to boarding.",
  ],
  [
    "ADDITIONAL DEPOSIT",
    "Depending on the destination, Red Sky Group may require a deposit greater than 50% to cover trip expenses such as fuel, handling, and overflight permits.",
  ],
  [
    "PASSENGER AND COMPANIONS RESPONSIBILITY",
    "The passenger agrees to use and fly in the aircraft at their own risk and responsibility, as do their companions. The passenger and their companions confirm that they have medical insurance and will be responsible for any hospital expenses in the event of an accident at the airport ramp or FBO facilities.",
  ],
  [
    "COMPLIANCE WITH SAFETY INSTRUCTIONS",
    "Passengers must comply at all times with all instructions and safety measures indicated by the Captain or First Officer. If crew instructions are not followed, Red Sky Group shall not be liable for any accidents occurring onboard the aircraft or airport facilities.",
  ],
  [
    "PROHIBITIONS ONBOARD THE AIRCRAFT",
    "- Throwing sanitary paper or towels into the toilet.\n- Standing while the aircraft is taxiing, taking off, landing, or during turbulence.\n- Improper use of electronic or entertainment equipment.\n- Excessive alcohol consumption.\n- Possession or use of weapons, drugs, or illegal substances.",
  ],
  [
    "TRANSPORT OF PROHIBITED ITEMS",
    "Transporting illegal substances, explosives, firearms, ammunition, or any items prohibited under the laws of Mexico or the United States is strictly forbidden. Transporting cash amounts exceeding legal limits without declaration is prohibited.",
  ],
  [
    "DAMAGES AND ADDITIONAL COSTS",
    "- Damage to aircraft electronic or entertainment equipment.\n- Burns or irreparable stains on seats, flooring or carpets.\n- Malfunction of aircraft toilet due to improper use.\n- Loss or damage to onboard furniture or amenities.",
  ],
  [
    "CANCELLATION POLICIES",
    "To cancel the private aviation service, the passenger must notify Red Sky Group at least 48 hours before the scheduled departure. Cancellations made less than 48 hours before departure will incur a charge of $3,300 USD plus tax. Cancellation requests must be submitted in writing to ventas@redskyg.com.",
  ],
  [
    "DISCLAIMER OF LIABILITY",
    "Red Sky Group shall not be liable for illegal actions committed by the passenger or their companions. Passengers agree to indemnify and hold harmless Red Sky Group and its personnel from any legal claims resulting from such actions.",
  ],
  [
    "COMPLIANCE WITH REGULATIONS",
    "Red Sky Group operates in strict compliance with aviation regulations in Mexico and the United States. Responsibility for compliance with laws related to transported goods or cash rests solely with the passenger.",
  ],
  [
    "REFUSAL OF SERVICE",
    "Red Sky Group reserves the right to refuse boarding or terminate services if illegal activity is suspected. No refund will be provided in such cases.",
  ],
  [
    "ACCEPTANCE OF TERMS AND CONDITIONS",
    "By booking and using the private jet of Red Sky Group, the passenger and their companions acknowledge and agree to comply with all terms and conditions set forth in this document.",
  ],
];

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().split("T")[0];
}

function formatDocumentDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/ /g, " ")
    .toUpperCase();
}

function formatMoney(value = 0) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function isSavedFlightQuote(quote) {
  return (
    Array.isArray(quote?.flight_quote_legs) ||
    Boolean(quote?.route_summary) ||
    quote?.total_usd !== undefined
  );
}

function hasSavedQuoteLegs(quote) {
  return Array.isArray(quote?.flight_quote_legs) && quote.flight_quote_legs.length > 0;
}

function getAirportCode(value) {
  if (typeof value === "string") return value.trim().toUpperCase();

  return String(
    value?.iata ||
      value?.IATA ||
      value?.icao ||
      value?.ICAO ||
      value?.aeropuerto ||
      value?.airport_code ||
      "",
  )
    .trim()
    .toUpperCase();
}

function getAirportDisplay(code, name) {
  const normalizedCode = getAirportCode(code) || "-";
  const normalizedName = String(name || "").trim();
  const suffixMatch = normalizedName.match(/\s+(international\s+airport)$/i);
  const rawShortName = suffixMatch
    ? normalizedName.slice(0, suffixMatch.index).trim()
    : normalizedName;
  const shortName = (/^[A-ZÁÉÍÓÚÜÑ\s.'-]+$/.test(rawShortName)
    ? rawShortName.toLocaleLowerCase("es-MX").replace(/(^|[\s.'-])([a-záéíóúüñ])/g, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("es-MX")}`)
    : rawShortName
  ).replace(/^Licenciado\b/i, "Lic.");

  return {
    name: normalizedName ? `${shortName || normalizedCode} - ${normalizedCode}` : normalizedCode,
    detail: "",
  };
}

function formatPdfDistance(value) {
  const label = String(value || "").trim();
  return label && label !== "-" ? `${label.replace(/\s*NM$/i, "")} NM` : "-";
}

function formatPdfTime(value) {
  const label = String(value || "").trim();
  const match = label.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  if (!match || (!match[1] && !match[2])) return "-";

  if (Number(match[1] || 0) === 0 && Number(match[2] || 0) === 0) {
    return "-";
  }

  return `${String(Number(match[1] || 0)).padStart(2, "0")}:${String(Number(match[2] || 0)).padStart(2, "0")}`;
}

function getDurationLabel(value) {
  const hours = Number(value);

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

function getSavedQuoteLegs(quote) {
  return [...(quote?.flight_quote_legs || [])]
    .sort((left, right) => Number(left?.leg_order || 0) - Number(right?.leg_order || 0))
    .map((leg) => {
      const isStartPositioning = leg?.leg_type === "positioning";
      const isReturnToBase = leg?.leg_type === "return_to_base";

      return {
        id: leg?.id,
        from_airport: leg?.from_iata || leg?.from_icao || "-",
        from_airport_name: leg?.from_airport_name || "",
        to_airport: leg?.to_iata || leg?.to_icao || "-",
        to_airport_name: leg?.to_airport_name || "",
        aircraft_id: quote?.aircraft_id || null,
        aircraft_fleet: {
          name: quote?.aircraft_name || "-",
        },
        passengers: leg?.passengers || quote?.passengers || null,
        positioning: isStartPositioning || isReturnToBase,
        positioningLabel: isReturnToBase ? "Return to base" : "Repositioning",
        distanceLabel:
          leg?.distance_nm == null ? "-" : String(Math.round(Number(leg.distance_nm) || 0)),
        durationLabel:
          leg?.billable_hours == null
            ? "-"
            : getDurationLabel(leg?.billable_hours),
      };
    });
}

function getSnapshotQuoteLegs(quote) {
  const snapshotLegs =
    quote?.calculation_snapshot?.billableLegs ||
    quote?.calculation_snapshot?.billableRoutes ||
    quote?.calculation_snapshot?.legs ||
    [];

  if (!Array.isArray(snapshotLegs) || !snapshotLegs.length) return [];

  return snapshotLegs
    .map((leg, index) => {
      const positioningType = leg?.positioningType || leg?.leg_type || "";
      const isReturnToBase = positioningType === "return_to_base";
      const isPositioning =
        positioningType === "repositioning" ||
        positioningType === "positioning" ||
        isReturnToBase;
      const fromAirport = getAirportCode(leg?.from_airport || leg?.from || leg?.from_iata);
      const toAirport = getAirportCode(leg?.to_airport || leg?.to || leg?.to_iata);

      if (!fromAirport || !toAirport) return null;

      return {
        id: leg?.id || `snapshot-leg-${index}`,
        from_airport: fromAirport,
        from_airport_name: leg?.from_airport_name || leg?.fromAirportName || "",
        to_airport: toAirport,
        to_airport_name: leg?.to_airport_name || leg?.toAirportName || "",
        aircraft_id: quote?.aircraft_id || leg?.aircraft_id || null,
        aircraft_fleet: {
          name: quote?.aircraft_name || "-",
        },
        passengers: leg?.passengers || quote?.passengers || null,
        positioning: isPositioning,
        positioningLabel: isReturnToBase ? "Return to base" : "Repositioning",
        distanceLabel:
          leg?.miles == null && leg?.distance_nm == null
            ? "-"
            : String(Math.round(Number(leg?.miles ?? leg?.distance_nm) || 0)),
        durationLabel: getDurationLabel(
          leg?.billableHours ?? leg?.billable_hours ?? leg?.estimatedHours,
        ),
      };
    })
    .filter(Boolean);
}

function getRouteSummaryQuoteLegs(quote) {
  const codes = String(quote?.route_summary || "")
    .split("-")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  if (codes.length < 2) return [];

  const closedCodes =
    codes[codes.length - 1] === codes[0] ? codes : [...codes, codes[0]];

  return closedCodes.slice(0, -1).map((fromAirport, index) => {
    const isRoundTripToBase =
      closedCodes.length > 2 && closedCodes[0] === closedCodes[closedCodes.length - 1];
    const isFirstPositioning = isRoundTripToBase && index === 0;
    const isReturnToBase = isRoundTripToBase && index === closedCodes.length - 2;

    return {
      id: `route-summary-leg-${index}`,
      from_airport: fromAirport,
      to_airport: closedCodes[index + 1],
      aircraft_id: quote?.aircraft_id || null,
      aircraft_fleet: {
        name: quote?.aircraft_name || "-",
      },
      passengers: quote?.passengers || null,
      positioning: isFirstPositioning || isReturnToBase,
      positioningLabel: isReturnToBase ? "Return to base" : "Repositioning",
      distanceLabel: "-",
      durationLabel: "-",
    };
  });
}

function getPdfLegs(quote) {
  if (hasSavedQuoteLegs(quote)) return getSavedQuoteLegs(quote);

  const snapshotLegs = getSnapshotQuoteLegs(quote);
  if (snapshotLegs.length) return snapshotLegs;

  const displayLegs = getDisplayQuoteLegs(quote);
  if (displayLegs.length) return displayLegs;

  return getRouteSummaryQuoteLegs(quote);
}

async function getPdfLegMetricsMap(quote, legs) {
  const computedMetrics = await getQuoteLegMetricsMap(legs);

  if (!isSavedFlightQuote(quote)) {
    return computedMetrics;
  }

  return legs.reduce((metrics, leg, index) => {
    const computed = computedMetrics[getLegMetricKey(leg, index)] || {};
    const savedDistance = String(leg?.distanceLabel || "").trim();
    const savedDuration = String(leg?.durationLabel || "").trim();
    const hasSavedDistance = savedDistance && savedDistance !== "-" && savedDistance !== "0";
    const hasSavedDuration =
      savedDuration &&
      savedDuration !== "-" &&
      !/^0+h(?:\s+0+m)?$/i.test(savedDuration) &&
      !/^0+m$/i.test(savedDuration);

    metrics[getLegMetricKey(leg, index)] = {
      distanceLabel: hasSavedDistance ? savedDistance : computed.distanceLabel,
      durationLabel: hasSavedDuration ? savedDuration : computed.durationLabel,
    };
    return metrics;
  }, {});
}

function getQuoteRoutePath(quote) {
  return isSavedFlightQuote(quote)
    ? quote?.route_summary || "-"
    : getDisplayRoutePath(quote);
}

async function getQuoteAircraftName(quote, firstRoute) {
  const fallbackName = getPreferredAircraftName(
    isSavedFlightQuote(quote) ? quote?.aircraft_name : firstRoute?.aircraft_fleet?.name,
    firstRoute?.aircraft_id || quote?.aircraft_id,
    "-",
  );

  if (fallbackName !== "-") return fallbackName;

  return resolveAircraftDisplayName({
    aircraftId: firstRoute?.aircraft_id || quote?.aircraft_id,
    aircraftName: isSavedFlightQuote(quote)
      ? quote?.aircraft_name
      : firstRoute?.aircraft_fleet?.name,
    fallback: "-",
  });
}

function getTripType(quote) {
  if (!isSavedFlightQuote(quote)) return quote?.flight_type || "Private Charter";

  return quote?.operation_type === "international"
    ? "International Charter"
    : "National Charter";
}

function getQuoteCostRows(quote, customerRoutes) {
  const customRows = quote?.calculation_snapshot?.pdfBreakdownRows;

  if (Array.isArray(customRows) && customRows.length) {
    const filteredRows = customRows
      .filter((row) => String(row?.label || "").trim())
      .map((row) => [String(row.label).trim(), Number(row.value || 0)]);

    if (filteredRows.length) {
      const hasLabel = (pattern) =>
        filteredRows.some(([label]) => pattern.test(String(label || "")));

      const normalizedRows = [...filteredRows];

      if (!hasLabel(/flight\s*cost/i) && Number(quote?.flight_cost_usd || 0) > 0) {
        normalizedRows.unshift(["Flight Cost", Number(quote.flight_cost_usd || 0)]);
      }

      if (!hasLabel(/overnight/i) && Number(quote?.overnight_cost_usd || 0) > 0) {
        normalizedRows.push(["Overnight Crew", Number(quote.overnight_cost_usd || 0)]);
      }

      if (!hasLabel(/operational/i) && Number(quote?.operational_expenses_usd || 0) > 0) {
        normalizedRows.push([
          "Operational Expenses",
          Number(quote.operational_expenses_usd || 0),
        ]);
      }

      return normalizedRows;
    }
  }

  if (isSavedFlightQuote(quote)) {
    return [
      ["Flight Cost", Number(quote?.flight_cost_usd || 0)],
      ["Overnight Crew", Number(quote?.overnight_cost_usd || 0)],
      ["Operational Expenses", Number(quote?.operational_expenses_usd || 0)],
      ["Tax (16%)", Number(quote?.tax_amount_usd || 0)],
    ];
  }

  const flightCost = customerRoutes.reduce(
    (sum, item) => sum + (Number(item?.estimated_price) || 0),
    0,
  );
  const total = Number(quote?.total_estimated_price ?? flightCost) || 0;
  const operationalExpenses = Math.max(total - flightCost, 0);

  return [
    ["Flight Cost", flightCost],
    ["Overnight Crew", 0],
    ["Operational Expenses", operationalExpenses],
  ];
}

function getQuoteTotal(quote, costRows) {
  if (isSavedFlightQuote(quote)) return Number(quote?.total_usd || 0);

  return (
    Number(quote?.total_estimated_price) ||
    costRows.reduce((sum, [, value]) => sum + Number(value || 0), 0)
  );
}

function drawTextPair(doc, label, value, x, y, width = 70) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.steel);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  const lines = doc.splitTextToSize(String(value || "-"), width);
  doc.text(lines, x, y + 5.2);
  return lines.length;
}

function drawTopBand(doc) {
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, PAGE.width, 6, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 6, PAGE.width, 0.9, "F");
}

function drawSideLabel(doc, label) {
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.7);
  doc.line(198, 65, 198, 262);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.gold);
  doc.text(label, 201, 178, { angle: 90, align: "center" });
}

function drawFooter(doc) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(145, 145, 145);
  doc.text("Red Sky Group", PAGE.marginX, PAGE.footerY);
  doc.text(`Page ${doc.getCurrentPageInfo().pageNumber} of ${doc.getNumberOfPages()}`, 184, PAGE.footerY, {
    align: "right",
  });
}

function prepareContinuationPage(doc) {
  doc.addPage();
  drawTopBand(doc);
  drawSideLabel(doc, "RED SKY GROUP PRIVATE AVIATION");
}

function addPageFooters(doc) {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(145, 145, 145);
    doc.text("Red Sky Group", PAGE.marginX, PAGE.footerY);
    doc.text(`Page ${i} of ${pageCount}`, 184, PAGE.footerY, {
      align: "right",
    });
  }

  doc.setTextColor(...COLORS.ink);
}

function drawSectionTitle(doc, title, x, y) {
  doc.setFillColor(...COLORS.gold);
  doc.roundedRect(x, y - 3.5, 2.1, 7, 0.8, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, x + 5, y + 1);
}

function drawInfoCard(doc, title, rows, x, y, width, height) {
  doc.setFillColor(...COLORS.gold);
  doc.rect(x, y - 1.8, width, 1.8, "F");
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, x + 6, y + 8.5);

  let rowY = y + 17;
  rows.forEach(([label, value]) => {
    const usedLines = drawTextPair(doc, label, value, x + 6, rowY, width - 12);
    rowY += 6.5 + usedLines * 3.2;
  });
}

function addLogo(doc, logo, x, y, width) {
  if (!logo.complete || logo.naturalWidth === 0) return;

  const ratio = logo.naturalHeight / logo.naturalWidth;
  const height = width * ratio;
  doc.addImage(logo, "PNG", x, y, width, height);
}

function drawCompactQuoteHeader(doc, logo, quote) {
  const headerX = 20;
  const headerY = 10.5;
  const headerWidth = 170;
  const headerHeight = 14.5;
  const logoWidth = 40;
  const titleX = 63;

  addLogo(doc, logo, headerX, headerY - 4.1, logoWidth);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.ink);
  doc.text("Executive Flight Quote", titleX, headerY + 5.8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.steel);
  doc.text("Professional Private Aviation", titleX, headerY + 11.4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text(`Reservation • ${formatDocumentDate(quote?.created_at || new Date())}`, 190, headerY + 7.9, {
    align: "right",
  });

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.35);
  doc.line(headerX, headerY + headerHeight + 2.1, headerX + headerWidth, headerY + headerHeight + 2.1);

  return headerY + headerHeight + 2.1;
}

function drawTermsPageHeader(doc, logo) {
  drawTopBand(doc);

  addLogo(doc, logo, 25, 23, 36);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text("TERMS AND CONDITIONS", 74, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.steel);
  doc.text("Private aviation service agreement", 74, 35);
  drawSideLabel(doc, "RED SKY GROUP TERMS");

  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(20, 43, 170, 235, 3, 3, "S");
  doc.setFillColor(...COLORS.goldSoft);
  doc.rect(24, 47, 3, 226, "F");
}

function addSectionText(doc, state, title, text, logo) {
  const maxTextWidth = 156;
  const lines = doc.splitTextToSize(text, maxTextWidth);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, 32, state.y);
  state.y += 3.7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.9);
  doc.setTextColor(...COLORS.steel);
  doc.text(lines, 32, state.y);
  state.y += lines.length * 2.55 + 1.5;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.2);
  doc.line(32, state.y, 184, state.y);
  state.y += 1.9;
}

async function loadLogo() {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `${import.meta.env.BASE_URL}images/logoo.png`;

  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  return img;
}

export async function generateFlightQuotePdf(quote) {
  const doc = new jsPDF({ compress: true });
  const customerRoutes = Array.isArray(quote?.quote_routes) ? quote.quote_routes : [];
  const routes = getPdfLegs(quote);
  const routeMetrics = await getPdfLegMetricsMap(quote, routes);
  const firstRoute = isSavedFlightQuote(quote)
    ? routes[0] || {}
    : getPrimaryQuoteRoute(quote) || {};
  const aircraftName = await getQuoteAircraftName(quote, firstRoute);
  const tripType = getTripType(quote);
  const costRows = getQuoteCostRows(quote, customerRoutes);
  const total = getQuoteTotal(quote, costRows);
  const exchangeRate = Number(quote?.exchange_rate || 0);
  const totalMxn =
    Number(quote?.total_mxn || 0) || (exchangeRate > 0 ? Number((total * exchangeRate).toFixed(2)) : 0);
  const showMxnInPdf = Boolean(quote?.calculation_snapshot?.show_mxn_in_pdf);
  const logo = await loadLogo();

  drawTopBand(doc);
  const headerBottomY = drawCompactQuoteHeader(doc, logo, quote);

  const clientRows = [
    ["Name", quote?.full_name || quote?.client_name || "-"],
    ["Email", quote?.email || quote?.client_email || "-"],
    ["Phone", quote?.phone || quote?.client_phone || "-"],
  ];
  const passengerCount = Number(firstRoute?.passengers ?? quote?.passengers ?? 0);
  const profileRows = [
    ["Aircraft", aircraftName],
    ["Route", getQuoteRoutePath(quote)],
    ["Trip Type", tripType],
    passengerCount > 0 ? ["Passengers", String(passengerCount)] : null,
  ].filter(Boolean);

  const infoCardsY = headerBottomY + 4.5;
  const infoCardHeight = 59;
  drawInfoCard(doc, "Client Information", clientRows, 20, infoCardsY, 82, infoCardHeight);
  drawInfoCard(doc, "Trip Profile", profileRows, 108, infoCardsY, 82, infoCardHeight);

  let y = infoCardsY + infoCardHeight + 3.5;

  drawSectionTitle(doc, "Flight Legs", 20, y);
  y += 9;

  doc.setFillColor(...COLORS.accentSoft);
  doc.roundedRect(20, y, 170, 8.5, 2, 2, "F");
  doc.setTextColor(...COLORS.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("#", 25, y + 5.6);
  doc.text("DEPARTURE", 38, y + 5.6);
  doc.text("ARRIVAL", 90, y + 5.6);
  doc.text("DIST (NM)", 146, y + 5.6, { align: "center" });
  doc.text("TIME", 176, y + 5.6, { align: "center" });
  y += 8.5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.ink);

  if (!routes.length) {
    doc.setFillColor(...COLORS.row);
    doc.rect(20, y, 170, 10, "F");
    doc.setFontSize(7.5);
    doc.text("No flight legs were registered for this quote.", 25, y + 6);
    y += 10;
  } else {
    routes.forEach((route, index) => {
      const departureAirport = getAirportDisplay(
        route?.from_airport,
        route?.from_airport_name,
      );
      const arrivalAirport = getAirportDisplay(
        route?.to_airport,
        route?.to_airport_name,
      );
      const fromName = doc.splitTextToSize(departureAirport.name, 44);
      const fromDetail = departureAirport.detail
        ? doc.splitTextToSize(departureAirport.detail, 44)
        : [];
      const toName = doc.splitTextToSize(arrivalAirport.name, 44);
      const toDetail = arrivalAirport.detail
        ? doc.splitTextToSize(arrivalAirport.detail, 44)
        : [];
      const metrics = routeMetrics[getLegMetricKey(route, index)] || {};
      const rowLineHeight = 2.7;
      const fromLineCount = fromName.length + fromDetail.length + (route?.positioning ? 1 : 0);
      const toLineCount = toName.length + toDetail.length;
      const rowHeight = Math.max(9, Math.max(fromLineCount, toLineCount) * rowLineHeight + 3);

      if (index % 2 === 0) {
        doc.setFillColor(...COLORS.row);
        doc.rect(20, y, 170, rowHeight, "F");
      }

      doc.setFontSize(5.25);
      doc.text(String(index + 1), 25, y + 4.6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text(fromName, 38, y + 4.2, { lineHeightFactor: 0.95 });
      doc.text(toName, 90, y + 4.2, { lineHeightFactor: 0.95 });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.1);
      doc.setTextColor(...COLORS.steel);
      const fromDetailY = y + 4.2 + fromName.length * rowLineHeight;
      const toDetailY = y + 4.2 + toName.length * rowLineHeight;
      if (fromDetail.length) doc.text(fromDetail, 38, fromDetailY, { lineHeightFactor: 0.95 });
      if (toDetail.length) doc.text(toDetail, 90, toDetailY, { lineHeightFactor: 0.95 });
      if (route?.positioning) {
        doc.text(
          route?.positioningLabel || "Positioning",
          38,
          fromDetailY + Math.max(fromDetail.length, 1) * rowLineHeight,
        );
      }

      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(5.5);
      doc.text(formatPdfDistance(metrics.distanceLabel), 146, y + rowHeight / 2 + 1, { align: "center" });
      doc.text(formatPdfTime(metrics.durationLabel), 176, y + rowHeight / 2 + 1, { align: "center" });

      doc.setDrawColor(...COLORS.line);
      doc.line(20, y + rowHeight, 190, y + rowHeight);
      y += rowHeight;
    });
  }

  const breakdownHeight = 13 + costRows.length * 5.8;
  const totalBlockHeight = showMxnInPdf && exchangeRate > 0 ? 28 : 20;
  const breakdownBlockHeight = 9 + breakdownHeight;

  y += 7;

  if (y + breakdownBlockHeight > FIRST_PAGE_CONTENT_MAX_Y) {
    prepareContinuationPage(doc);
    y = 28;
  }

  drawSectionTitle(doc, "Commercial Breakdown", 20, y);
  y += 9;

  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(20, y, 170, breakdownHeight, 4, 4, "FD");
  doc.setFillColor(...COLORS.accentSoft);
  doc.roundedRect(24, y + 4.5, 162, 8.5, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...COLORS.navy);
  doc.text("DESCRIPTION", 29, y + 9.9);
  doc.text("AMOUNT", 180, y + 9.9, { align: "right" });

  let rowY = y + 17;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...COLORS.ink);

  costRows.forEach(([label, value], index) => {
    if (index % 2 === 1) {
      doc.setFillColor(...COLORS.white);
      doc.rect(24, rowY - 4.1, 162, 5.8, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.text(label, 29, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(formatMoney(value), 180, rowY, { align: "right" });
    rowY += 5.8;
  });

  y += breakdownHeight + 9;

  if (y + totalBlockHeight > FIRST_PAGE_CONTENT_MAX_Y) {
    prepareContinuationPage(doc);
    y = 28;
  }

  doc.setFillColor(...COLORS.gold);
  doc.rect(20, y - 2, 170, 2, "F");
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(20, y, 170, totalBlockHeight, 3, 3, "F");
  doc.setFillColor(37, 57, 79);
  doc.roundedRect(137, y + 4, 48, 10.5, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  doc.setTextColor(...COLORS.white);
  doc.text("SUMMARY", 26, y + 5.4);
  doc.setFontSize(8.6);
  doc.text("TOTAL ESTIMATED BALANCE", 26, y + 10.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.9);
  doc.text("Estimated in USD, subject to itinerary confirmation", 26, y + 16.2);
  doc.setFontSize(11.8);
  doc.setFont("helvetica", "bold");
  doc.text(`${formatMoney(total)} USD`, 181.5, y + 11.3, { align: "right" });
  if (showMxnInPdf && exchangeRate > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.8);
    doc.text(`${formatMoney(totalMxn)} MXN`, 181.5, y + 20.6, {
      align: "right",
    });
  }

  doc.addPage();
  drawTermsPageHeader(doc, logo);
  const termsState = { y: 52 };

  TERMS.forEach(([title, text]) => {
    addSectionText(doc, termsState, title, text, logo);
  });

  addPageFooters(doc);
  return doc;
}
