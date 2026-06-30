<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { supabase } from "@/supabase";
import { generateFlightQuotePdf } from "@/utils/flightQuotePdf";

const quotes = ref([]);
const loading = ref(true);
const selectedQuote = ref(null);
const pdfPreviewUrl = ref("");
const pdfPreviewName = ref("");
const pdfPreviewQuote = ref(null);
const generatingPdfId = ref(null);
const editingPdf = ref(false);
const savingPdfEdit = ref(false);
const pdfEditor = ref(null);

function formatDateTime(date) {
  if (!date) return "-";

  return new Date(date).toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function money(value, currency = "USD") {
  const amount = Number(value) || 0;

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}

function normalizeAirportCode(value) {
  return String(value || "").trim().toUpperCase();
}

function buildRouteSummaryLegs(quote) {
  const codes = String(quote?.route_summary || "")
    .split("-")
    .map((code) => normalizeAirportCode(code))
    .filter(Boolean);

  if (codes.length < 2) return [];

  return codes.slice(0, -1).map((from_iata, index) => ({
    id: `route-summary-leg-${index}`,
    leg_order: index + 1,
    leg_type: "client",
    visible_to_client: true,
    from_iata,
    to_iata: codes[index + 1],
    distance_nm: 0,
    billable_hours: 0,
    amount_usd: 0,
    passengers: normalizePassengers(quote?.passengers),
  }));
}

function normalizePassengers(value) {
  const passengers = Number(value);
  return Number.isFinite(passengers) && passengers > 0 ? passengers : null;
}

function buildSnapshotLegs(quote) {
  const snapshotLegs =
    quote?.calculation_snapshot?.billableLegs ||
    quote?.calculation_snapshot?.billableRoutes ||
    quote?.calculation_snapshot?.legs ||
    [];

  if (!Array.isArray(snapshotLegs) || !snapshotLegs.length) return [];

  return snapshotLegs
    .map((leg, index) => {
      const from_iata = normalizeAirportCode(
        leg?.from_iata || leg?.from_airport || leg?.from,
      );
      const to_iata = normalizeAirportCode(
        leg?.to_iata || leg?.to_airport || leg?.to,
      );

      if (!from_iata || !to_iata) return null;

      const legType = String(leg?.leg_type || leg?.positioningType || "").toLowerCase();
      const visibleToClient =
        leg?.visible_to_client ??
        !["positioning", "repositioning", "return_to_base"].includes(legType);

      return {
        id: leg?.id || `snapshot-leg-${index}`,
        leg_order: Number(leg?.leg_order || index + 1),
        leg_type: legType || "client",
        visible_to_client: visibleToClient,
        from_iata,
        to_iata,
        distance_nm: Number(leg?.distance_nm ?? leg?.miles ?? 0),
        billable_hours: Number(
          leg?.billable_hours ?? leg?.billableHours ?? leg?.estimatedHours ?? 0,
        ),
        amount_usd: Number(leg?.amount_usd || 0),
        passengers: normalizePassengers(leg?.passengers ?? quote?.passengers),
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.leg_order || 0) - Number(right.leg_order || 0));
}

function formatHoursToTimeInput(value) {
  const hours = Number(value || 0);

  if (!Number.isFinite(hours) || hours <= 0) {
    return "";
  }

  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(wholeHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseTimeInputToHours(value) {
  const normalized = String(value || "").trim();

  if (!normalized) return 0;

  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const [, hours, minutes] = match;
  return Number(hours) + Number(minutes) / 60;
}

function getLegs(quote) {
  const savedLegs = [...(quote?.flight_quote_legs || [])].sort(
    (left, right) => Number(left?.leg_order || 0) - Number(right?.leg_order || 0),
  );

  if (savedLegs.length) return savedLegs;

  const snapshotLegs = buildSnapshotLegs(quote);
  if (snapshotLegs.length) return snapshotLegs;

  return buildRouteSummaryLegs(quote);
}

function getClientLegs(quote) {
  return getLegs(quote).filter((leg) => leg.leg_type === "client");
}

function getFinalDestination(quote) {
  const clientLegs = getClientLegs(quote);
  return clientLegs[clientLegs.length - 1]?.to_iata || "-";
}

function getQuotePdfFileName(quote) {
  const routeName = String(quote?.route_summary || "")
    .trim()
    .toUpperCase()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${routeName || quote?.quote_number || "flight-quote"}.pdf`;
}

function updatePreviewNameFromEditor() {
  if (!pdfEditor.value) return;

  pdfPreviewName.value = getQuotePdfFileName({
    ...pdfPreviewQuote.value,
    route_summary: pdfEditor.value.route_summary,
  });
}

async function generateQuotePdf(quote) {
  generatingPdfId.value = quote.id;

  try {
    const doc = await generateFlightQuotePdf(quote);
    const pdfBlob = doc.output("blob");

    if (pdfPreviewUrl.value) {
      URL.revokeObjectURL(pdfPreviewUrl.value);
    }

    pdfPreviewName.value = getQuotePdfFileName(quote);
    pdfPreviewQuote.value = quote;
    pdfPreviewUrl.value = URL.createObjectURL(pdfBlob);
  } finally {
    generatingPdfId.value = null;
  }
}

function closePdfPreview() {
  if (pdfPreviewUrl.value) {
    URL.revokeObjectURL(pdfPreviewUrl.value);
  }

  pdfPreviewUrl.value = "";
  pdfPreviewName.value = "";
  pdfPreviewQuote.value = null;
  editingPdf.value = false;
  pdfEditor.value = null;
}

function editPreviewQuote() {
  if (!pdfPreviewQuote.value?.id) return;

  pdfEditor.value = buildPdfEditorState(pdfPreviewQuote.value);
  recalculateTaxBreakdown();
  editingPdf.value = true;
}

function buildPdfEditorState(quote) {
  const savedBreakdownRows = quote.calculation_snapshot?.pdfBreakdownRows;
  const cleanedBreakdownRows = Array.isArray(savedBreakdownRows)
    ? savedBreakdownRows
        .map((row) => ({
          label: row.label || "Concept",
          value: Number(row.value || 0),
        }))
    : [];
  const breakdownRows = Array.isArray(savedBreakdownRows) && savedBreakdownRows.length
    ? cleanedBreakdownRows.length
      ? cleanedBreakdownRows
      : [
          { label: "Flight Cost", value: Number(quote.flight_cost_usd || 0) },
          { label: "Overnight Crew", value: Number(quote.overnight_cost_usd || 0) },
          {
            label: "Operational Expenses",
            value: Number(quote.operational_expenses_usd || 0),
          },
        ]
    : [
        { label: "Flight Cost", value: Number(quote.flight_cost_usd || 0) },
        { label: "Overnight Crew", value: Number(quote.overnight_cost_usd || 0) },
        {
          label: "Operational Expenses",
          value: Number(quote.operational_expenses_usd || 0),
        },
        { label: "Tax (16%)", value: Number(quote.tax_amount_usd || 0) },
      ];

  return {
    quote_number: quote.quote_number || "",
    status: quote.status || "calculated",
    client_name: quote.client_name || "",
    client_email: quote.client_email || "",
    client_phone: quote.client_phone || "",
    flight_type: quote.flight_type || "Private Jet",
    quote_mode: quote.quote_mode || "complete",
    time_mode: quote.time_mode || "block",
    aircraft_id: quote.aircraft_id || null,
    aircraft_name: quote.aircraft_name || "",
    aircraft_tail: quote.aircraft_tail || null,
    aircraft_capacity: quote.aircraft_capacity || null,
    aircraft_base: quote.aircraft_base || null,
    departure_at: quote.departure_at || null,
    return_at: quote.return_at || null,
    route_summary: quote.route_summary || "",
    operation_type: quote.operation_type || "national",
    passengers: normalizePassengers(quote.passengers),
    client_flight_hours: Number(quote.client_flight_hours || 0),
    hourly_rate_usd: Number(quote.hourly_rate_usd || 0),
    flight_cost_usd: Number(quote.flight_cost_usd || 0),
    repositioning_cost_usd: Number(quote.repositioning_cost_usd || 0),
    return_to_base_cost_usd: Number(quote.return_to_base_cost_usd || 0),
    overnight_cost_usd: Number(quote.overnight_cost_usd || 0),
    operational_expenses_usd: Number(quote.operational_expenses_usd || 0),
    tax_amount_usd: Number(quote.tax_amount_usd || 0),
    total_usd: Number(quote.total_usd || 0),
    exchange_rate: Number(quote.exchange_rate || 0),
    total_mxn: Number(quote.total_mxn || 0),
    show_total_mxn:
      quote.calculation_snapshot?.pdfTotals?.show_total_mxn ??
      Number(quote.total_mxn || quote.calculation_snapshot?.pdfTotals?.total_mxn || 0) > 0,
    notes: quote.notes || null,
    calculation_version: quote.calculation_version || "v1",
    breakdownRows,
    legs: getLegs(quote).map((leg) => ({
      id: leg.id,
      leg_order: Number(leg.leg_order || 0),
      leg_type: leg.leg_type || "client",
      visible_to_client: leg.visible_to_client,
      from_iata: leg.from_iata || leg.from_icao || "",
      to_iata: leg.to_iata || leg.to_icao || "",
      distance_nm: Number(leg.distance_nm || 0),
      billable_hours: Number(leg.billable_hours || 0),
      billable_hours_input: formatHoursToTimeInput(leg.billable_hours),
      amount_usd: Number(leg.amount_usd || 0),
      passengers: normalizePassengers(leg.passengers ?? quote.passengers),
    })),
  };
}

function closePdfEditor() {
  editingPdf.value = false;
  pdfEditor.value = null;
}

function updateEditorTotal() {
  if (!pdfEditor.value) return;

  pdfEditor.value.total_usd = Number(pdfEditor.value.total_usd || 0);
  recalculateTaxBreakdown();
}

function isTaxBreakdownRow(row) {
  return /tax|iva|impuesto/i.test(String(row?.label || ""));
}

function recalculateTaxBreakdown() {
  if (!pdfEditor.value) return;

  const taxRow = pdfEditor.value.breakdownRows.find(isTaxBreakdownRow);
  const subtotal = pdfEditor.value.breakdownRows
    .filter((row) => !isTaxBreakdownRow(row))
    .reduce((sum, row) => sum + Number(row.value || 0), 0);

  if (!taxRow) {
    syncStandardBreakdownFields();
    return;
  }

  const total = Number(pdfEditor.value.total_usd || 0);
  taxRow.value = Number(Math.max(total - subtotal, 0).toFixed(2));
  syncStandardBreakdownFields();
}

function handleBreakdownValueInput(row) {
  recalculateTaxBreakdown();
}

function handleBreakdownLabelInput() {
  recalculateTaxBreakdown();
}

function syncStandardBreakdownFields() {
  if (!pdfEditor.value) return;

  const findRowValue = (patterns) => {
    const row = pdfEditor.value.breakdownRows.find((item) =>
      patterns.some((pattern) => pattern.test(String(item.label || ""))),
    );

    return Number(row?.value || 0);
  };

  pdfEditor.value.flight_cost_usd = findRowValue([/flight\s*cost/i]);
  pdfEditor.value.overnight_cost_usd = findRowValue([/overnight/i]);
  pdfEditor.value.operational_expenses_usd = findRowValue([/operational/i]);
  pdfEditor.value.tax_amount_usd = findRowValue([/tax/i]);
}

function getBreakdownSubtotal() {
  if (!pdfEditor.value) return 0;

  return pdfEditor.value.breakdownRows
    .filter((row) => !isTaxBreakdownRow(row))
    .reduce((sum, row) => sum + Number(row.value || 0), 0);
}

function getEditorPassengers() {
  return normalizePassengers(pdfEditor.value?.passengers);
}

function syncEditorLegPassengers() {
  if (!pdfEditor.value) return;

  const passengers = getEditorPassengers();
  pdfEditor.value.passengers = passengers;
  pdfEditor.value.legs.forEach((leg) => {
    leg.passengers = passengers;
  });
}

function buildPdfCalculationSnapshot() {
  if (!pdfEditor.value) return {};

  const passengers = getEditorPassengers();

  return {
    ...(pdfPreviewQuote.value?.calculation_snapshot || {}),
    pdfBreakdownRows: pdfEditor.value.breakdownRows.map((row) => ({
      label: String(row.label || "Concept").trim() || "Concept",
      value: Number(row.value || 0),
    })),
    pdfLegs: pdfEditor.value.legs.map((leg, index) => ({
      id: leg.id || `pdf-leg-${index + 1}`,
      leg_order: index + 1,
      leg_type: leg.leg_type || "client",
      visible_to_client: leg.visible_to_client ?? leg.leg_type === "client",
      from_iata: String(leg.from_iata || "").trim().toUpperCase(),
      to_iata: String(leg.to_iata || "").trim().toUpperCase(),
      distance_nm: Number(leg.distance_nm || 0),
      billable_hours: Number(leg.billable_hours || 0),
      amount_usd: Number(leg.amount_usd || 0),
      passengers,
    })),
    pdfTotals: {
      client_flight_hours: Number(pdfEditor.value.client_flight_hours || 0),
      hourly_rate_usd: Number(pdfEditor.value.hourly_rate_usd || 0),
      flight_cost_usd: Number(pdfEditor.value.flight_cost_usd || 0),
      repositioning_cost_usd: Number(pdfEditor.value.repositioning_cost_usd || 0),
      return_to_base_cost_usd: Number(pdfEditor.value.return_to_base_cost_usd || 0),
      overnight_cost_usd: Number(pdfEditor.value.overnight_cost_usd || 0),
      operational_expenses_usd: Number(pdfEditor.value.operational_expenses_usd || 0),
      tax_amount_usd: Number(pdfEditor.value.tax_amount_usd || 0),
      total_usd: Number(pdfEditor.value.total_usd || 0),
      exchange_rate: Number(pdfEditor.value.exchange_rate || 0),
      total_mxn: pdfEditor.value.show_total_mxn
        ? Number(pdfEditor.value.total_mxn || 0)
        : 0,
      show_total_mxn: Boolean(pdfEditor.value.show_total_mxn),
    },
  };
}

function addBreakdownRow() {
  if (!pdfEditor.value) return;

  pdfEditor.value.breakdownRows.push({
    label: "New Concept",
    value: 0,
  });
}

function removeBreakdownRow(index) {
  if (!pdfEditor.value) return;

  pdfEditor.value.breakdownRows.splice(index, 1);
  recalculateTaxBreakdown();
}

function addEditorLeg() {
  if (!pdfEditor.value) return;

  const lastLeg = pdfEditor.value.legs[pdfEditor.value.legs.length - 1];
  pdfEditor.value.legs.push({
    id: null,
    leg_order: pdfEditor.value.legs.length + 1,
    leg_type: "client",
    visible_to_client: true,
    from_iata: lastLeg?.to_iata || "",
    to_iata: "",
    distance_nm: 0,
    billable_hours: 1,
    billable_hours_input: "01:00",
    amount_usd: 0,
    passengers: getEditorPassengers(),
  });
}

function removeEditorLeg(index) {
  if (!pdfEditor.value) return;

  pdfEditor.value.legs.splice(index, 1);
}

function handleLegTimeInput(leg) {
  if (!leg) return;

  leg.billable_hours = parseTimeInputToHours(leg.billable_hours_input);
}

function buildRouteSummaryFromLegs(legs) {
  const path = [];

  legs.forEach((leg, index) => {
    const from = String(leg.from_iata || "").trim().toUpperCase();
    const to = String(leg.to_iata || "").trim().toUpperCase();

    if (!from || !to) return;

    if (index === 0) {
      path.push(from, to);
      return;
    }

    if (path[path.length - 1] !== from) {
      path.push(from);
    }

    path.push(to);
  });

  if (path.length > 1 && path[path.length - 1] !== path[0]) {
    path.push(path[0]);
  }

  return path.join("-");
}

async function savePdfEditor() {
  if (!pdfPreviewQuote.value?.id || !pdfEditor.value || savingPdfEdit.value) return;

  savingPdfEdit.value = true;

  try {
    syncEditorLegPassengers();

    const routeSummary =
      pdfEditor.value.route_summary.trim() ||
      buildRouteSummaryFromLegs(pdfEditor.value.legs);
    const passengers = getEditorPassengers();
    const subtotalUsd = getBreakdownSubtotal();
    const taxAmountUsd = Number(pdfEditor.value.tax_amount_usd || 0);
    const totalUsd = Number(pdfEditor.value.total_usd || 0);
    if (!pdfEditor.value.show_total_mxn) {
      pdfEditor.value.total_mxn = 0;
    }
    const exchangeRate = Number(
      pdfPreviewQuote.value?.exchange_rate ||
      selectedQuote.value?.exchange_rate ||
      0,
    );
    const showTotalMxn = Boolean(pdfEditor.value.show_total_mxn);
    const totalMxn = showTotalMxn ? Number(pdfEditor.value.total_mxn || 0) || null : null;
    const taxRate = subtotalUsd > 0 ? Number((taxAmountUsd / subtotalUsd).toFixed(4)) : 0;
    const billableHours = pdfEditor.value.legs.reduce(
      (sum, leg) => sum + Number(leg.billable_hours || 0),
      0,
    );
    const totalDistance = pdfEditor.value.legs.reduce(
      (sum, leg) => sum + Number(leg.distance_nm || 0),
      0,
    );

    const quotePayload = {
      quote_number: pdfEditor.value.quote_number || pdfPreviewQuote.value.quote_number || null,
      status: pdfEditor.value.status || pdfPreviewQuote.value.status || "calculated",
      client_name: pdfEditor.value.client_name,
      client_email: pdfEditor.value.client_email || null,
      client_phone: pdfEditor.value.client_phone || null,
      flight_type: pdfEditor.value.flight_type || "Private Jet",
      quote_mode: pdfEditor.value.quote_mode || "complete",
      time_mode: pdfEditor.value.time_mode || "block",
      aircraft_id: pdfEditor.value.aircraft_id || null,
      aircraft_name: pdfEditor.value.aircraft_name,
      aircraft_tail: pdfEditor.value.aircraft_tail || null,
      aircraft_capacity: pdfEditor.value.aircraft_capacity || null,
      aircraft_base: pdfEditor.value.aircraft_base || null,
      departure_at: pdfEditor.value.departure_at || null,
      return_at: pdfEditor.value.return_at || null,
      route_summary: routeSummary,
      operation_type: pdfEditor.value.operation_type,
      passengers,
      client_flight_hours: Number(pdfEditor.value.client_flight_hours || 0),
      hourly_rate_usd: Number(pdfEditor.value.hourly_rate_usd || 0),
      flight_cost_usd: Number(pdfEditor.value.flight_cost_usd || 0),
      repositioning_cost_usd: Number(pdfEditor.value.repositioning_cost_usd || 0),
      return_to_base_cost_usd: Number(pdfEditor.value.return_to_base_cost_usd || 0),
      overnight_cost_usd: Number(pdfEditor.value.overnight_cost_usd || 0),
      operational_expenses_usd: Number(pdfEditor.value.operational_expenses_usd || 0),
      subtotal_usd: subtotalUsd,
      tax_rate: taxRate,
      tax_amount_usd: taxAmountUsd,
      total_usd: totalUsd,
      exchange_rate: exchangeRate || null,
      total_mxn: totalMxn,
      notes: String(pdfEditor.value.notes || "").trim() || null,
      calculation_version: pdfEditor.value.calculation_version || "v1",
      billable_hours: billableHours,
      total_distance_nm: totalDistance,
      calculation_snapshot: buildPdfCalculationSnapshot(),
    };

    const { data: updatedRows, error: quoteError } = await supabase
      .from("flight_quotes")
      .update(quotePayload)
      .eq("id", pdfPreviewQuote.value.id)
      .select("id");

    if (quoteError) throw quoteError;

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      throw new Error(
        "La base no actualizo ninguna fila en flight_quotes. Revisa permisos UPDATE/RLS o que el id exista.",
      );
    }

    const quoteId = pdfPreviewQuote.value.id;

    const { error: deleteLegsError } = await supabase
      .from("flight_quote_legs")
      .delete()
      .eq("quote_id", quoteId);

    if (deleteLegsError) throw deleteLegsError;

    const legsPayload = pdfEditor.value.legs
      .filter((leg) => leg.from_iata && leg.to_iata)
      .map((leg, index) => ({
        quote_id: quoteId,
        leg_order: index + 1,
        leg_type: leg.leg_type || "client",
        visible_to_client: leg.visible_to_client ?? leg.leg_type === "client",
        from_iata: String(leg.from_iata || "").trim().toUpperCase(),
        to_iata: String(leg.to_iata || "").trim().toUpperCase(),
        distance_nm: Number(leg.distance_nm || 0),
        billable_hours: Number(leg.billable_hours || 0),
        amount_usd: Number(leg.amount_usd || 0),
        passengers,
      }));

    if (legsPayload.length) {
      const { error: legsError } = await supabase
        .from("flight_quote_legs")
        .insert(legsPayload);

      if (legsError) throw legsError;
    }

    const updatedQuote = {
      ...pdfPreviewQuote.value,
      ...quotePayload,
      id: quoteId,
      flight_quote_legs: legsPayload,
    };

    quotes.value = quotes.value.map((item) =>
      item.id === updatedQuote.id ? updatedQuote : item,
    );
    pdfPreviewQuote.value = updatedQuote;
    selectedQuote.value = updatedQuote;
    editingPdf.value = false;
    pdfEditor.value = null;
    await fetchQuotes();
    await generateQuotePdf(updatedQuote);
  } catch (error) {
    console.error("Unable to update PDF quote", error);
    window.alert(`No se pudo guardar la edicion del PDF.\n${error?.message || error || ""}`);
  } finally {
    savingPdfEdit.value = false;
  }
}

function downloadPreviewPdf() {
  if (!pdfPreviewUrl.value) return;

  const link = document.createElement("a");
  link.href = pdfPreviewUrl.value;
  link.download = pdfPreviewName.value || "flight-quote.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printPreviewPdf() {
  if (!pdfPreviewUrl.value) return;

  const printWindow = window.open(pdfPreviewUrl.value, "_blank", "noopener");

  if (!printWindow) {
    window.alert("Permite ventanas emergentes para imprimir el PDF.");
    return;
  }

  printWindow.addEventListener(
    "load",
    () => {
      printWindow.focus();
      printWindow.print();
    },
    { once: true },
  );
}

async function fetchQuotes() {
  loading.value = true;

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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load flight quotes", error);
    quotes.value = [];
  } else {
    quotes.value = data || [];
  }

  loading.value = false;
}

async function deleteQuote(id) {
  if (!window.confirm("Eliminar esta cotizacion de vuelo?")) return;

  const { error } = await supabase.from("flight_quotes").delete().eq("id", id);

  if (error) {
    console.error("Unable to delete flight quote", error);
    return;
  }

  quotes.value = quotes.value.filter((quote) => quote.id !== id);

  if (selectedQuote.value?.id === id) {
    selectedQuote.value = null;
  }
}

onMounted(fetchQuotes);

onBeforeUnmount(() => {
  closePdfPreview();
});
</script>

<template>
  <section class="admin-container">
    <div class="page-head">
      <div>
        <p class="eyebrow">Cotizaciones de vuelo</p>
        <h1>Lista de cotizaciones admin</h1>
        <p class="subtitle">
          Cotizaciones guardadas desde las tablas flight_quotes y flight_quote_legs.
        </p>
      </div>
      <strong class="count-pill">{{ quotes.length }} registros</strong>
    </div>

    <div v-if="loading" class="state-card">Cargando cotizaciones...</div>

    <div v-else-if="!quotes.length" class="state-card">
      No hay cotizaciones de vuelo guardadas todavia.
    </div>

    <div v-else class="table-wrapper">
      <table class="quotes-table">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Ruta</th>
            <th>Destino final</th>
            <th>Salida</th>
            <th>Regreso</th>
            <th>PAX</th>
            <th>Aeronave</th>
            <th>Operacion</th>
            <th>Horas</th>
            <th>Total USD</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="quote in quotes" :key="quote.id">
            <td>
              <strong>{{ quote.quote_number || quote.id }}</strong>
              <small>{{ quote.status || "calculated" }}</small>
            </td>
            <td>{{ formatDateTime(quote.created_at) }}</td>
            <td>{{ quote.client_name || "-" }}</td>
            <td class="route-path">{{ quote.route_summary || "-" }}</td>
            <td>{{ getFinalDestination(quote) }}</td>
            <td>{{ formatDateTime(quote.departure_at) }}</td>
            <td>{{ formatDateTime(quote.return_at) }}</td>
            <td>{{ quote.passengers || "-" }}</td>
            <td>{{ quote.aircraft_name || "-" }}</td>
            <td>{{ quote.operation_type === "international" ? "Internacional" : "Nacional" }}</td>
            <td>{{ Number(quote.billable_hours || 0).toFixed(2) }} h</td>
            <td class="price">{{ money(quote.total_usd, "USD") }}</td>
            <td class="actions">
              <button class="view-btn" type="button" @click="selectedQuote = quote">
                Ver
              </button>
              <button
                class="pdf-btn"
                type="button"
                :disabled="generatingPdfId === quote.id"
                @click="generateQuotePdf(quote)"
              >
                {{ generatingPdfId === quote.id ? "..." : "PDF" }}
              </button>
              <button class="delete-btn" type="button" @click="deleteQuote(quote.id)">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pdfPreviewUrl" class="modal-overlay pdf-preview-overlay">
      <div class="pdf-preview-card">
        <header class="modal-header pdf-preview-header">
          <div>
            <p class="eyebrow">Vista previa PDF</p>
            <h2>{{ pdfPreviewName }}</h2>
          </div>
          <div class="pdf-preview-actions">
            <button class="pdf-action-btn edit-action" type="button" @click="editPreviewQuote">
              Editar
            </button>
            <button class="pdf-action-btn download-action" type="button" @click="downloadPreviewPdf">
              Descargar
            </button>
            <button class="pdf-action-btn print-action" type="button" @click="printPreviewPdf">
              Imprimir
            </button>
            <button class="close-btn" type="button" @click="closePdfPreview">x</button>
          </div>
        </header>

        <div v-if="editingPdf && pdfEditor" class="pdf-edit-page">
          <div class="pdf-edit-topline"></div>

          <section class="pdf-edit-cards">
            <article class="pdf-edit-card">
              <span class="pdf-card-bar"></span>
              <h3>Client Information</h3>
              <label>NAME</label>
              <input v-model="pdfEditor.client_name" />
              <label>PHONE</label>
              <input v-model="pdfEditor.client_phone" />
            </article>

            <article class="pdf-edit-card">
              <span class="pdf-card-bar"></span>
              <h3>Trip Profile</h3>
              <label>AIRCRAFT</label>
              <input v-model="pdfEditor.aircraft_name" />
              <label>ROUTE</label>
              <input v-model="pdfEditor.route_summary" @input="updatePreviewNameFromEditor" />
              <label>TRIP TYPE</label>
              <select v-model="pdfEditor.operation_type">
                <option value="national">National Charter</option>
                <option value="international">International Charter</option>
              </select>
              <label>PASSENGERS</label>
              <input
                v-model.number="pdfEditor.passengers"
                type="number"
                min="1"
                placeholder="Opcional"
                @input="syncEditorLegPassengers"
              />
            </article>
          </section>

          <section class="pdf-edit-section">
            <h3><span></span>Flight Legs</h3>
            <div class="pdf-edit-table-wrap">
              <table class="pdf-edit-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Departure</th>
                    <th>Arrival</th>
                    <th>Dist (NM)</th>
                    <th>Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(leg, index) in pdfEditor.legs" :key="index">
                    <td>{{ index + 1 }}</td>
                    <td><input v-model="leg.from_iata" /></td>
                    <td><input v-model="leg.to_iata" /></td>
                    <td><input v-model.number="leg.distance_nm" type="number" min="0" /></td>
                    <td>
                      <input
                        v-model="leg.billable_hours_input"
                        type="text"
                        inputmode="numeric"
                        placeholder="01:30"
                        @input="handleLegTimeInput(leg)"
                      />
                    </td>
                    <td>
                      <button class="tiny-danger" type="button" @click="removeEditorLeg(index)">x</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button class="small-add-btn" type="button" @click="addEditorLeg">
              Agregar tramo
            </button>
          </section>

          <section class="pdf-edit-section">
            <h3><span></span>Commercial Breakdown</h3>
            <div class="pdf-edit-breakdown">
              <div
                v-for="(row, index) in pdfEditor.breakdownRows"
                :key="index"
                class="pdf-breakdown-editor-row"
              >
                <input
                  v-model="row.label"
                  class="breakdown-label-input"
                  placeholder="Concepto"
                  @input="handleBreakdownLabelInput"
                />
                <input
                  v-model.number="row.value"
                  class="breakdown-money-input"
                  type="number"
                  min="0"
                  step="0.01"
                  @input="handleBreakdownValueInput(row)"
                />
                <button class="tiny-danger" type="button" @click="removeBreakdownRow(index)">
                  x
                </button>
              </div>
            </div>
            <button class="small-add-btn" type="button" @click="addBreakdownRow">
              Agregar concepto
            </button>
          </section>

          <section class="pdf-edit-section">
            <h3><span></span>Notes</h3>
            <textarea
              v-model="pdfEditor.notes"
              class="pdf-notes-input"
              rows="4"
              placeholder="Escribe notas adicionales para mostrar en el PDF"
            ></textarea>
          </section>

          <section class="pdf-edit-total">
            <div>
              <strong>TOTAL ESTIMATED BALANCE</strong>
              <small>Estimated in USD, subject to itinerary confirmation</small>
            </div>
            <div class="pdf-total-fields">
              <label class="pdf-total-toggle">
                <input v-model="pdfEditor.show_total_mxn" type="checkbox" />
                <span>Mostrar MXN en PDF</span>
              </label>
              <label v-if="pdfEditor.show_total_mxn">
                <span>Valor total MXN</span>
                <input
                  v-model.number="pdfEditor.total_mxn"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
              <input
                v-model.number="pdfEditor.total_usd"
                type="number"
                min="0"
                step="0.01"
                @input="updateEditorTotal"
              />
            </div>
          </section>

          <div class="pdf-edit-footer-actions">
            <button class="pdf-action-btn download-action" type="button" @click="closePdfEditor">
              Cancelar
            </button>
            <button
              class="pdf-action-btn print-action"
              type="button"
              :disabled="savingPdfEdit"
              @click="savePdfEditor"
            >
              {{ savingPdfEdit ? "Guardando..." : "Guardar y regenerar PDF" }}
            </button>
          </div>
        </div>

        <iframe
          v-else
          :src="pdfPreviewUrl"
          class="pdf-preview-frame"
          title="Vista previa de PDF"
        ></iframe>
      </div>
    </div>

    <div v-if="selectedQuote" class="modal-overlay">
      <div class="modal-card">
        <header class="modal-header">
          <div>
            <p class="eyebrow">Detalle</p>
            <h2>{{ selectedQuote.quote_number || "Cotizacion" }}</h2>
          </div>
          <button class="close-btn" type="button" @click="selectedQuote = null">x</button>
        </header>

        <div class="detail-grid">
          <article>
            <span>Cliente</span>
            <strong>{{ selectedQuote.client_name || "-" }}</strong>
          </article>
          <article>
            <span>Aeronave</span>
            <strong>{{ selectedQuote.aircraft_name || "-" }}</strong>
          </article>
          <article>
            <span>Ruta</span>
            <strong>{{ selectedQuote.route_summary || "-" }}</strong>
          </article>
          <article>
            <span>Modo</span>
            <strong>{{ selectedQuote.quote_mode }} / {{ selectedQuote.time_mode }}</strong>
          </article>
          <article>
            <span>Vuelo</span>
            <strong>{{ money(selectedQuote.flight_cost_usd, "USD") }}</strong>
          </article>
          <article>
            <span>Gastos operativos</span>
            <strong>{{ money(selectedQuote.operational_expenses_usd, "USD") }}</strong>
          </article>
          <article>
            <span>Tax</span>
            <strong>{{ Number((selectedQuote.tax_rate || 0) * 100).toFixed(0) }}%</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>{{ money(selectedQuote.total_usd, "USD") }}</strong>
          </article>
        </div>

        <h3>Tramos guardados</h3>
        <div class="legs-list">
          <article v-for="leg in getLegs(selectedQuote)" :key="leg.id" class="leg-row">
            <div>
              <strong>{{ leg.from_iata }} -> {{ leg.to_iata }}</strong>
              <span>
                {{ leg.leg_type }} - {{ Number(leg.distance_nm || 0).toFixed(0) }} nm -
                {{ Number(leg.billable_hours || 0).toFixed(2) }} h
              </span>
            </div>
            <strong>{{ money(leg.amount_usd, "USD") }}</strong>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-container {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.page-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 0.4rem;
  color: #0f5fa6;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h1,
h2,
h3 {
  margin: 0;
}

.subtitle {
  margin: 0.4rem 0 0;
  color: var(--text-muted);
}

.count-pill,
.state-card {
  border-radius: 18px;
  border: 1px solid rgba(15, 95, 166, 0.12);
  background: white;
}

.count-pill {
  padding: 0.8rem 1rem;
  color: #0f5fa6;
}

.state-card {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 20px;
  background: white;
  border: 1px solid rgba(15, 95, 166, 0.1);
}

.quotes-table {
  width: 100%;
  min-width: 1320px;
  border-collapse: collapse;
}

.quotes-table th,
.quotes-table td {
  padding: 0.8rem;
  border-bottom: 1px solid rgba(15, 95, 166, 0.08);
  text-align: left;
  vertical-align: top;
}

.quotes-table th {
  background: #0b1c2d;
  color: white;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.quotes-table small,
.leg-row span,
.detail-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.route-path {
  min-width: 170px;
  font-weight: 800;
  color: #0f5fa6;
}

.price {
  color: #0f5fa6;
  font-weight: 800;
}

.actions {
  display: flex;
  gap: 0.45rem;
}

.view-btn,
.pdf-btn,
.delete-btn,
.close-btn,
.pdf-action-btn {
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 800;
}

.view-btn {
  padding: 0.55rem 0.75rem;
  background: rgba(15, 95, 166, 0.1);
  color: #0f5fa6;
}

.pdf-btn {
  padding: 0.55rem 0.75rem;
  background: rgba(22, 163, 74, 0.1);
  color: #15803d;
}

.pdf-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}

.delete-btn {
  padding: 0.55rem 0.75rem;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(2, 6, 23, 0.68);
}

.modal-card {
  width: min(920px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  padding: 1.4rem;
  border-radius: 20px;
  background: white;
}

.pdf-preview-overlay {
  z-index: 10000;
}

.pdf-preview-card {
  width: min(1100px, calc(100vw - 32px));
  height: min(92vh, 900px);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.1rem;
  border-radius: 20px;
  background: white;
}

.pdf-preview-header {
  flex-shrink: 0;
}

.pdf-preview-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pdf-action-btn {
  padding: 0.65rem 0.9rem;
}

.download-action {
  background: rgba(15, 95, 166, 0.1);
  color: #0f5fa6;
}

.edit-action {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.print-action {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.pdf-preview-frame {
  width: 100%;
  min-height: 0;
  flex: 1;
  border: 1px solid rgba(15, 95, 166, 0.12);
  border-radius: 14px;
  background: #f8fafc;
}

.pdf-edit-page {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 18px 28px;
  border: 1px solid rgba(15, 95, 166, 0.12);
  border-radius: 14px;
  background: #ffffff;
  position: relative;
}

.pdf-edit-topline {
  height: 4px;
  margin: -18px -18px 18px;
  background: #bf893e;
}

.pdf-edit-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.pdf-edit-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 22px 22px 18px;
  border: 1px solid #d6dfe9;
  border-radius: 14px;
  background: #f8fbff;
  overflow: hidden;
}

.pdf-card-bar {
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  background: #bf893e;
}

.pdf-edit-card h3,
.pdf-edit-section h3 {
  margin: 0 0 14px;
  color: #0f172a;
  font-size: 16px;
}

.pdf-edit-card label,
.pdf-edit-breakdown label {
  color: #475569;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.pdf-edit-card input,
.pdf-edit-card select,
.pdf-edit-table input,
.pdf-edit-breakdown input,
.pdf-notes-input,
.pdf-edit-total input {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 9px;
  background: rgba(255, 255, 255, 0.72);
  color: #0f172a;
  font: inherit;
  box-sizing: border-box;
}

.pdf-edit-card input:focus,
.pdf-edit-card select:focus,
.pdf-edit-table input:focus,
.pdf-edit-breakdown input:focus,
.pdf-notes-input:focus,
.pdf-edit-total input:focus {
  border-color: #0f5fa6;
  outline: none;
  background: white;
  box-shadow: 0 0 0 3px rgba(15, 95, 166, 0.1);
}

.pdf-edit-section {
  margin-top: 22px;
}

.pdf-edit-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pdf-edit-section h3 span {
  width: 7px;
  height: 24px;
  border-radius: 999px;
  background: #bf893e;
}

.pdf-edit-table-wrap,
.pdf-edit-breakdown {
  border: 1px solid #d6dfe9;
  border-radius: 14px;
  background: #f8fbff;
  overflow: hidden;
}

.pdf-edit-table {
  width: 100%;
  border-collapse: collapse;
}

.pdf-edit-table th {
  padding: 11px 12px;
  background: #e8eef6;
  color: #103759;
  font-size: 10px;
  text-transform: uppercase;
  text-align: left;
}

.pdf-edit-table td {
  padding: 8px 10px;
  border-top: 1px solid #d6dfe9;
  font-size: 12px;
}

.pdf-edit-table tr:nth-child(odd) td {
  background: #f1f6fa;
}

.tiny-danger {
  border: none;
  border-radius: 8px;
  padding: 6px 9px;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  font-weight: 900;
  cursor: pointer;
}

.small-add-btn {
  margin-top: 10px;
  border: none;
  border-radius: 10px;
  padding: 9px 12px;
  background: rgba(15, 95, 166, 0.1);
  color: #0f5fa6;
  font-weight: 900;
  cursor: pointer;
}

.pdf-edit-breakdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
}

.pdf-breakdown-editor-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(120px, 180px) auto;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 10px;
  background: #f1f6fa;
}

.breakdown-label-input,
.breakdown-money-input {
  margin: 0;
}

.breakdown-money-input {
  text-align: right;
  font-weight: 900;
}

.pdf-notes-input {
  min-height: 96px;
  resize: vertical;
  line-height: 1.45;
}

.pdf-edit-total {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px;
  border-top: 4px solid #bf893e;
  border-radius: 0 0 12px 12px;
  background: #0a1f33;
  color: white;
}

.pdf-edit-total strong,
.pdf-edit-total small {
  display: block;
}

.pdf-edit-total small {
  margin-top: 7px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 11px;
}

.pdf-edit-total input {
  max-width: 210px;
  background: rgba(255, 255, 255, 0.08);
  color: white;
  font-size: 24px;
  font-weight: 900;
  text-align: right;
}

.pdf-total-fields {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.pdf-total-fields label {
  display: grid;
  gap: 5px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-align: right;
  text-transform: uppercase;
}

.pdf-total-fields .pdf-total-toggle {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  cursor: pointer;
}

.pdf-total-toggle input {
  width: 16px;
  max-width: 16px;
  height: 16px;
  padding: 0;
  accent-color: #bf893e;
}

.pdf-total-fields label input {
  max-width: 160px;
  font-size: 16px;
}

.pdf-edit-total input:focus {
  color: #0f172a;
}

.pdf-edit-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.close-btn {
  width: 34px;
  height: 34px;
  background: rgba(15, 95, 166, 0.08);
  color: #0f5fa6;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1rem 0 1.2rem;
}

.detail-grid article,
.leg-row {
  padding: 0.85rem;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid rgba(15, 95, 166, 0.08);
}

.legs-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.leg-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

@media (max-width: 900px) {
  .page-head,
  .leg-row,
  .pdf-preview-header {
    flex-direction: column;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pdf-edit-cards,
  .pdf-edit-breakdown {
    grid-template-columns: 1fr;
  }

  .pdf-edit-total,
  .pdf-edit-footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .pdf-edit-total input {
    max-width: none;
  }

  .pdf-preview-actions,
  .pdf-action-btn {
    width: 100%;
  }
}
</style>
