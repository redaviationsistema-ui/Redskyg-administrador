import * as XLSX from "xlsx";
import { supabase } from "@/supabase";

const TABLE_NAME = "commercial_opportunities";

export const COMMERCIAL_STATUS_OPTIONS = [
  "pendiente",
  "contactado",
  "cotizando",
  "cotizado",
  "solicitada proveedor",
  "enviada cliente",
  "en negociacion",
  "aceptada",
  "ganada",
  "facturada",
  "pagada",
  "no aceptada",
  "perdida",
  "cancelada",
];

export const COMMERCIAL_CURRENCY_OPTIONS = ["USD", "MXN", "EUR"];

export const COMMERCIAL_REQUEST_TYPE_OPTIONS = [
  "Vuelo chárter",
  "Empty leg",
  "Aeronave compartida",
  "Cargo ligero",
  "Vuelo sanitario",
  "Oportunidad corporativa",
];

const SAMPLE_RECORDS = [
  {
    id: "cm-1001",
    folio: "CC-2026-001",
    createdAt: "2026-07-18",
    updatedAt: "2026-07-20T08:30:00.000Z",
    customerName: "Mariana López",
    companyName: "Grupo Altaria",
    email: "mariana@altaria.mx",
    phone: "+52 55 1111 2233",
    route: "Toluca - Miami",
    origin: "TLC",
    destination: "MIA",
    passengers: 6,
    aircraft: "Learjet 60XR",
    provider: "JetStream Partners",
    status: "en negociacion",
    providerPrice: 32500,
    fbo: "Signature MIA",
    salePrice: 39200,
    profit: 6700,
    margin: 17.09,
    currency: "USD",
    nextFollowUp: "2026-07-21",
    executive: "Andrea Ruiz",
    requestType: "Vuelo chárter",
    potentialRevenue: 39200,
    confirmedRevenue: 0,
    expectedProfit: 6700,
    notes: [
      {
        id: "note-1",
        text: "Cliente sensible al tiempo de respuesta. Solicita opción con WiFi.",
        createdAt: "2026-07-20T09:10:00.000Z",
        author: "Andrea Ruiz",
      },
    ],
    attachments: [
      {
        id: "att-1",
        name: "cotizacion-inicial.pdf",
        sizeLabel: "240 KB",
        type: "application/pdf",
        createdAt: "2026-07-20T09:12:00.000Z",
      },
    ],
    timeline: [
      {
        id: "tl-1",
        title: "Oportunidad creada",
        detail: "Registro manual desde Centro Comercial.",
        createdAt: "2026-07-18T14:10:00.000Z",
      },
      {
        id: "tl-2",
        title: "Seguimiento agendado",
        detail: "Llamada con dirección de operaciones para validar catering premium.",
        createdAt: "2026-07-20T08:30:00.000Z",
      },
    ],
  },
  {
    id: "cm-1002",
    folio: "CC-2026-002",
    createdAt: "2026-07-17",
    updatedAt: "2026-07-19T16:20:00.000Z",
    customerName: "Roberto Sánchez",
    companyName: "North Peak Capital",
    email: "roberto@northpeak.com",
    phone: "+1 305 555 9011",
    route: "Monterrey - Cancún",
    origin: "MTY",
    destination: "CUN",
    passengers: 4,
    aircraft: "Phenom 300E",
    provider: "Avia Charter MX",
    status: "aceptada",
    providerPrice: 16200,
    fbo: "MRO Services CUN",
    salePrice: 19850,
    profit: 3650,
    margin: 18.39,
    currency: "USD",
    nextFollowUp: "2026-07-22",
    executive: "Carlos Vega",
    requestType: "Oportunidad corporativa",
    potentialRevenue: 19850,
    confirmedRevenue: 19850,
    expectedProfit: 3650,
    notes: [],
    attachments: [],
    timeline: [
      {
        id: "tl-3",
        title: "Cotización aceptada",
        detail: "Se aprobó el itinerario final con salida el 24 de julio.",
        createdAt: "2026-07-19T16:20:00.000Z",
      },
    ],
  },
  {
    id: "cm-1003",
    folio: "CC-2026-003",
    createdAt: "2026-07-15",
    updatedAt: "2026-07-18T12:00:00.000Z",
    customerName: "Lucía Herrera",
    companyName: "Private Family Office",
    email: "lucia@pfo.mx",
    phone: "+52 81 7777 9900",
    route: "Guadalajara - Los Cabos",
    origin: "GDL",
    destination: "SJD",
    passengers: 8,
    aircraft: "Hawker 800XP",
    provider: "Baja Air Support",
    status: "pendiente proveedor",
    providerPrice: 0,
    fbo: "Cabo FBO",
    salePrice: 0,
    profit: 0,
    margin: 0,
    currency: "USD",
    nextFollowUp: "2026-07-20",
    executive: "Andrea Ruiz",
    requestType: "Vuelo chárter",
    potentialRevenue: 24500,
    confirmedRevenue: 0,
    expectedProfit: 4200,
    notes: [],
    attachments: [],
    timeline: [
      {
        id: "tl-4",
        title: "Solicitud pendiente",
        detail: "Esperando disponibilidad de operador y slot de salida.",
        createdAt: "2026-07-18T12:00:00.000Z",
      },
    ],
  },
];

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeId(prefix = "cm") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatSizeLabel(size) {
  const bytes = toNumber(size);
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function serializeRecord(record) {
  const providerPrice = toNumber(record.providerPrice);
  const salePrice = toNumber(record.salePrice);
  const fbo = toNumber(record.fbo);
  const profit = salePrice - providerPrice - fbo;
  const margin = salePrice > 0 ? Number(((profit / salePrice) * 100).toFixed(2)) : 0;
  const normalizedStatus = String(record.status || "abierta").toLowerCase().trim();

  return {
    id: record.id || safeId("cm"),
    folio: record.folio || `CC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`,
    createdAt: record.createdAt || new Date().toISOString().slice(0, 10),
    updatedAt: record.updatedAt || new Date().toISOString(),
    customerName: String(record.customerName || "").trim(),
    companyName: String(record.companyName || "").trim(),
    email: String(record.email || "").trim(),
    phone: String(record.phone || "").trim(),
    route: String(record.route || "").trim(),
    origin: String(record.origin || "").trim().toUpperCase(),
    destination: String(record.destination || "").trim().toUpperCase(),
    passengers: toNumber(record.passengers),
    aircraft: String(record.aircraft || "").trim(),
    provider: String(record.provider || "").trim(),
    status: normalizedStatus === "abierta" ? "pendiente" : normalizedStatus,
    providerPrice,
    fbo,
    salePrice,
    profit,
    margin,
    currency: String(record.currency || "USD").trim().toUpperCase(),
    nextFollowUp: String(record.nextFollowUp || "").trim(),
    executive: String(record.executive || "").trim(),
    requestType: String(record.requestType || "").trim(),
    potentialRevenue: toNumber(record.potentialRevenue || salePrice),
    confirmedRevenue:
      normalizedStatus === "aceptada" || normalizedStatus === "vuelo vendido"
        ? toNumber(record.confirmedRevenue || salePrice)
        : toNumber(record.confirmedRevenue),
    expectedProfit: toNumber(record.expectedProfit || profit),
    flightQuoteId: record.flightQuoteId || null,
    solicitud: String(record.solicitud || "").trim(),
    contacto: String(record.contacto || "").trim(),
    whatsapp: String(record.whatsapp || "").trim(),
    observaciones: String(record.observaciones || "").trim(),
    notes: Array.isArray(record.notes) ? record.notes : [],
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    timeline: Array.isArray(record.timeline) ? record.timeline : [],
  };
}

function readLocalRecords() {
  if (!canUseStorage()) {
    return SAMPLE_RECORDS.map(serializeRecord);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = SAMPLE_RECORDS.map(serializeRecord);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(serializeRecord) : SAMPLE_RECORDS.map(serializeRecord);
  } catch {
    return SAMPLE_RECORDS.map(serializeRecord);
  }
}

function writeLocalRecords(records) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map(serializeRecord)));
}

function matchesValue(text, search) {
  if (!search) return true;
  return String(text || "").toLowerCase().includes(String(search || "").toLowerCase());
}

function applyFilters(records, filters = {}) {
  const minPrice = filters.minPrice === "" ? null : toNumber(filters.minPrice);
  const maxPrice = filters.maxPrice === "" ? null : toNumber(filters.maxPrice);

  return records.filter((record) => {
    if (!matchesValue(record.customerName, filters.customer)) return false;
    if (!matchesValue(record.companyName, filters.company)) return false;
    if (!matchesValue(record.email, filters.email)) return false;
    if (!matchesValue(record.phone, filters.phone)) return false;
    if (!matchesValue(record.route, filters.route)) return false;
    if (!matchesValue(record.origin, filters.origin)) return false;
    if (!matchesValue(record.destination, filters.destination)) return false;
    if (!matchesValue(record.provider, filters.provider)) return false;
    if (!matchesValue(record.aircraft, filters.aircraft)) return false;
    if (!matchesValue(record.executive, filters.executive)) return false;

    if (filters.status && filters.status !== "all" && record.status !== filters.status) return false;
    if (filters.currency && filters.currency !== "all" && record.currency !== filters.currency) return false;
    if (filters.requestType && filters.requestType !== "all" && record.requestType !== filters.requestType) return false;

    if (filters.date && record.createdAt !== filters.date) return false;
    if (minPrice !== null && record.salePrice < minPrice) return false;
    if (maxPrice !== null && record.salePrice > maxPrice) return false;

    return true;
  });
}

function normalizeOpportunity(row) {
  return serializeRecord({
    id: row.id,
    folio: row.folio || row.quote_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.cliente,
    companyName: row.empresa,
    email: row.email,
    phone: row.telefono,
    route: row.ruta,
    origin: row.origen,
    destination: row.destino,
    passengers: row.pasajeros,
    provider: row.proveedor,
    status: row.status,
    providerPrice: row.precio_proveedor,
    fbo: row.costo_fbo,
    salePrice: row.precio_final,
    profit: row.utilidad,
    margin: row.margen,
    currency: row.moneda,
    nextFollowUp: row.proximo_seguimiento,
    executive: row.responsable,
    requestType: row.tipo_servicio || row.solicitud,
    potentialRevenue: row.precio_final,
    confirmedRevenue: ["GANADA", "ACEPTADA", "FACTURADA", "PAGADA"].includes(String(row.status || "").toUpperCase())
      ? row.precio_final
      : 0,
    expectedProfit: row.utilidad,
    flightQuoteId: row.quote_id,
    solicitud: row.solicitud,
    contacto: row.contacto,
    whatsapp: row.whatsapp,
    observaciones: row.observaciones,
    notes: [],
    attachments: [],
    timeline: row.observaciones
      ? [{ id: `obs-${row.id}`, title: "Observaciones", detail: row.observaciones, createdAt: row.updated_at || row.created_at }]
      : [],
  });
}

function buildOpportunityPayload(record) {
  const payload = {
    cliente: String(record.customerName || "").trim(),
    empresa: String(record.companyName || "").trim() || null,
    contacto: String(record.contacto || "").trim() || null,
    telefono: String(record.phone || "").trim() || null,
    whatsapp: String(record.whatsapp || "").trim() || null,
    email: String(record.email || "").trim() || null,
    solicitud: String(record.solicitud || record.requestType || "").trim(),
    tipo_servicio: String(record.requestType || "").trim() || null,
    ruta: String(record.route || "").trim() || null,
    origen: String(record.origin || "").trim().toUpperCase() || null,
    destino: String(record.destination || "").trim().toUpperCase() || null,
    pasajeros: toNumber(record.passengers),
    proveedor: String(record.provider || "").trim() || null,
    responsable: String(record.executive || "").trim() || null,
    status: String(record.status || "PENDIENTE").trim().toUpperCase(),
    precio_proveedor: toNumber(record.providerPrice),
    costo_fbo: toNumber(record.fbo),
    precio_final: toNumber(record.salePrice),
    moneda: String(record.currency || "USD").trim().toUpperCase(),
    proximo_seguimiento: record.nextFollowUp || null,
    observaciones: String(record.observaciones || "").trim() || null,
    activo: true,
  };

  if (record.flightQuoteId) {
    payload.quote_id = record.flightQuoteId;
  }

  return payload;
}

async function tryRemoteList() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("activo", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeOpportunity);
}

async function tryRemoteUpsert(record) {
  const payload = buildOpportunityPayload(record);
  const isPersisted = record.id && !String(record.id).startsWith("cm-");
  const query = isPersisted
    ? supabase.from(TABLE_NAME).update(payload).eq("id", record.id)
    : supabase.from(TABLE_NAME).insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return normalizeOpportunity(data);
}

async function tryRemoteDelete(recordId) {
  const { error } = await supabase.from(TABLE_NAME).update({ activo: false }).eq("id", recordId);
  if (error) {
    throw error;
  }
}

export async function listCommercialRecords(filters = {}) {
  const records = await tryRemoteList();
  return { rows: applyFilters(records, filters), source: "supabase" };
}

export async function saveCommercialRecord(record) {
  const saved = await tryRemoteUpsert(record);
  return { row: saved, source: "supabase" };
}

export async function removeCommercialRecord(recordId) {
  await tryRemoteDelete(recordId);
  return { source: "supabase" };
}


function exportRows(rows) {
  return rows.map((row) => ({
    Folio: row.folio,
    Fecha: row.createdAt,
    Cliente: row.customerName,
    Empresa: row.companyName,
    Contacto: `${row.email} / ${row.phone}`,
    Ruta: row.route,
    Pasajeros: row.passengers,
    Aeronave: row.aircraft,
    Proveedor: row.provider,
    Estado: row.status,
    "Precio proveedor": row.providerPrice,
    FBO: row.fbo,
    "Precio venta": row.salePrice,
    Utilidad: row.profit,
    Margen: row.margin,
    Moneda: row.currency,
    "Próximo seguimiento": row.nextFollowUp,
    Ejecutivo: row.executive,
    "Última actualización": row.updatedAt,
  }));
}

function downloadBlob(blob, filename) {
  if (typeof window === "undefined") return;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function exportCommercialCsv(rows) {
  const dataset = exportRows(rows);
  const headers = Object.keys(dataset[0] || {});
  const csvLines = [
    headers.join(","),
    ...dataset.map((item) =>
      headers
        .map((header) => `"${String(item[header] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  downloadBlob(new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" }), "centro-comercial.csv");
}

export function exportCommercialExcel(rows) {
  const worksheet = XLSX.utils.json_to_sheet(exportRows(rows));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Centro Comercial");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "centro-comercial.xlsx",
  );
}

export function createEmptyCommercialRecord(overrides = {}) {
  return serializeRecord({
    id: safeId("cm"),
    folio: "",
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    customerName: "",
    companyName: "",
    email: "",
    phone: "",
    route: "",
    origin: "",
    destination: "",
    passengers: 1,
    aircraft: "",
    provider: "",
    status: "abierta",
    providerPrice: 0,
    fbo: "",
    salePrice: 0,
    currency: "USD",
    nextFollowUp: "",
    executive: "",
    requestType: "Vuelo chárter",
    potentialRevenue: 0,
    confirmedRevenue: 0,
    expectedProfit: 0,
    notes: [],
    attachments: [],
    timeline: [],
    ...overrides,
  });
}

export function createAttachmentFromFile(file) {
  return {
    id: safeId("att"),
    name: file?.name || "archivo",
    sizeLabel: formatSizeLabel(file?.size),
    type: file?.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
  };
}
