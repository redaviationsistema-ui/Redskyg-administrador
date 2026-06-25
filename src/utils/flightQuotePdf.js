import jsPDF from "jspdf";
import {
  getDisplayQuoteLegs,
  getDisplayRoutePath,
  getPrimaryQuoteRoute,
} from "@/utils/quoteRouteDisplay";
import { getLegMetricKey, getQuoteLegMetricsMap } from "@/utils/quoteLegMetrics";

const PAGE = {
  width: 210,
  height: 297,
  marginX: 20,
  contentWidth: 170,
  footerY: 287,
};

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

function formatMoney(value = 0) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
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

function getDurationLabel(value) {
  const hours = Number(value);

  if (!Number.isFinite(hours) || hours <= 0) return "-";

  return `${Math.round(hours)} hrs`;
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
        to_airport: leg?.to_iata || leg?.to_icao || "-",
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
            : `${Math.round(Number(leg.billable_hours) || 0)} hrs`,
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
        to_airport: toAirport,
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
  if (!isSavedFlightQuote(quote)) {
    return getQuoteLegMetricsMap(legs);
  }

  return legs.reduce((metrics, leg, index) => {
    metrics[getLegMetricKey(leg, index)] = {
      distanceLabel: leg.distanceLabel,
      durationLabel: leg.durationLabel,
    };
    return metrics;
  }, {});
}

function getQuoteRoutePath(quote) {
  return isSavedFlightQuote(quote)
    ? quote?.route_summary || "-"
    : getDisplayRoutePath(quote);
}

function getQuoteAircraftName(quote, firstRoute) {
  return isSavedFlightQuote(quote)
    ? quote?.aircraft_name || "-"
    : firstRoute?.aircraft_fleet?.name || firstRoute?.aircraft_id || "-";
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
    return customRows
      .filter((row) => String(row?.label || "").trim())
      .map((row) => [String(row.label).trim(), Number(row.value || 0)]);
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
  doc.rect(0, 0, PAGE.width, 12, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 12, PAGE.width, 1.3, "F");
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
  doc.text(title, x + 6, y + 10);

  let rowY = y + 22;
  rows.forEach(([label, value]) => {
    const usedLines = drawTextPair(doc, label, value, x + 6, rowY, width - 12);
    rowY += 8 + usedLines * 4;
  });
}

function addLogo(doc, logo, x, y, width) {
  if (!logo.complete || logo.naturalWidth === 0) return;

  const ratio = logo.naturalHeight / logo.naturalWidth;
  const height = width * ratio;
  doc.addImage(logo, "PNG", x, y, width, height);
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
  const aircraftName = getQuoteAircraftName(quote, firstRoute);
  const tripType = getTripType(quote);
  const costRows = getQuoteCostRows(quote, customerRoutes);
  const total = getQuoteTotal(quote, costRows);
  const logo = await loadLogo();

  drawTopBand(doc);
  drawSideLabel(doc, "RED SKY GROUP PRIVATE AVIATION");

  addLogo(doc, logo, 25, 26, 48);

  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(142, 16, 48, 24, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(221, 230, 240);
  doc.text("DATE", 147, 25);
  doc.text("DOCUMENT", 147, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...COLORS.white);
  doc.text(formatDate(quote?.created_at || new Date()), 181, 25, {
    align: "right",
  });
  doc.text("Reservation", 181, 34, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...COLORS.ink);
  doc.text("Executive Flight Quote", 20, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.steel);
  doc.text("Professional private aviation quotation", 20, 61);

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.35);
  doc.line(20, 67, 190, 67);

  const clientRows = [
    ["Name", quote?.full_name || quote?.client_name || "-"],
    ["Email", quote?.email || quote?.client_email || "-"],
    ["Phone", quote?.phone || quote?.client_phone || "-"],
  ];
  const profileRows = [
    ["Aircraft", aircraftName],
    ["Route", getQuoteRoutePath(quote)],
    ["Trip Type", tripType],
    ["Passengers", String(firstRoute?.passengers || quote?.passengers || 0)],
  ];

  drawInfoCard(doc, "Client Information", clientRows, 20, 75, 82, 62);
  drawInfoCard(doc, "Trip Profile", profileRows, 108, 75, 82, 62);

  let y = 149;

  drawSectionTitle(doc, "Flight Legs", 20, y);
  y += 12;

  doc.setFillColor(...COLORS.accentSoft);
  doc.roundedRect(20, y, 170, 10, 2, 2, "F");
  doc.setTextColor(...COLORS.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.text("#", 25, y + 6.4);
  doc.text("DEPARTURE", 38, y + 6.4);
  doc.text("ARRIVAL", 90, y + 6.4);
  doc.text("DIST (NM)", 140, y + 6.4, { align: "right" });
  doc.text("TIME", 182, y + 6.4, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.ink);

  if (!routes.length) {
    doc.setFillColor(...COLORS.row);
    doc.rect(20, y, 170, 12, "F");
    doc.setFontSize(8);
    doc.text("No flight legs were registered for this quote.", 25, y + 7);
    y += 12;
  } else {
    routes.forEach((route, index) => {
      const fromLabel = route?.positioning
        ? `${route?.from_airport || "-"} (${route?.positioningLabel || "Positioning"})`
        : route?.from_airport || "-";
      const fromText = doc.splitTextToSize(fromLabel, 44);
      const toText = doc.splitTextToSize(route?.to_airport || "-", 44);
      const metrics = routeMetrics[getLegMetricKey(route, index)] || {};
      const rowHeight = Math.max(12, Math.max(fromText.length, toText.length) * 4.5 + 6);

      if (index % 2 === 0) {
        doc.setFillColor(...COLORS.row);
        doc.rect(20, y, 170, rowHeight, "F");
      }

      doc.setFontSize(7.7);
      doc.text(String(index + 1), 25, y + 7);
      doc.text(fromText, 38, y + 7);
      doc.text(toText, 90, y + 7);
      doc.text(metrics.distanceLabel || "-", 140, y + 7, { align: "right" });
      doc.text(metrics.durationLabel || "-", 182, y + 7, { align: "right" });

      doc.setDrawColor(...COLORS.line);
      doc.line(20, y + rowHeight, 190, y + rowHeight);
      y += rowHeight;
    });
  }

  y += 10;

  drawSectionTitle(doc, "Commercial Breakdown", 20, y);
  y += 12;

  const breakdownHeight = 16 + costRows.length * 6.8;

  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(20, y, 170, breakdownHeight, 4, 4, "FD");
  doc.setFillColor(...COLORS.accentSoft);
  doc.roundedRect(24, y + 5, 162, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.navy);
  doc.text("DESCRIPTION", 29, y + 11.4);
  doc.text("AMOUNT", 180, y + 11.4, { align: "right" });

  let rowY = y + 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);

  costRows.forEach(([label, value], index) => {
    if (index % 2 === 1) {
      doc.setFillColor(...COLORS.white);
      doc.rect(24, rowY - 4.8, 162, 6.8, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.text(label, 29, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(formatMoney(value), 180, rowY, { align: "right" });
    rowY += 6.8;
  });

  y = Math.max(y + breakdownHeight + 13, 260);

  doc.setFillColor(...COLORS.gold);
  doc.rect(20, y - 2, 170, 2, "F");
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(20, y, 170, 20, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.white);
  doc.text("TOTAL ESTIMATED BALANCE", 26, y + 7.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.text("Estimated in USD, subject to itinerary confirmation", 26, y + 14);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${formatMoney(total)} USD`, 185, y + 12.5, { align: "right" });

  doc.addPage();
  drawTermsPageHeader(doc, logo);
  const termsState = { y: 52 };

  TERMS.forEach(([title, text]) => {
    addSectionText(doc, termsState, title, text, logo);
  });

  addPageFooters(doc);
  return doc;
}
