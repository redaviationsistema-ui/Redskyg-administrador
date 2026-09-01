import jsPDF from "jspdf";

const PAGE = { width: 210, height: 297, margin: 20, contentWidth: 170 };
const COLORS = {
  ink: [15, 23, 42],
  steel: [71, 85, 105],
  steelSoft: [107, 114, 128],
  accent: [10, 31, 51],
  navy: [16, 55, 89],
  gold: [190, 137, 62],
  line: [214, 223, 233],
  panel: [248, 251, 255],
  row: [241, 246, 250],
  white: [255, 255, 255],
};

function value(input, fallback = "-") {
  const normalized = String(input || "").trim();
  return normalized || fallback;
}

function money(input) {
  return `$${Number(input || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}

function documentDate(input) {
  const date = new Date(input || Date.now());
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date).toUpperCase();
}

function routeFromQuote(quote) {
  if (value(quote?.route_summary, "") !== "") return value(quote.route_summary);
  const legs = [...(quote?.flight_quote_legs || [])]
    .sort((a, b) => Number(a?.leg_order || 0) - Number(b?.leg_order || 0))
    .filter((leg) => leg?.leg_type !== "positioning");
  if (!legs.length) return "POR DEFINIR";
  return legs.reduce((route, leg, index) => {
    if (!index) route.push(value(leg?.from_iata, ""));
    route.push(value(leg?.to_iata, ""));
    return route;
  }, []).filter(Boolean).join("-");
}

function drawTopBand(doc) {
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, PAGE.width, 6, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 6, PAGE.width, 0.9, "F");
}

function drawFrameAndFooter(doc, page, pageCount) {
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(9.5, 9.5, PAGE.width - 19, PAGE.height - 19);
  doc.setDrawColor(...COLORS.navy);
  doc.line(14, 274.5, PAGE.width - 14, 274.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.steelSoft);
  doc.text("RED AVIATION COMPANY | ventas@redaviationcorp.com | redskyg.com/mx", 14, 280);
  doc.text(`Página ${page} de ${pageCount}`, PAGE.width - 11, 280, { align: "right" });
}

function addLogo(doc, logo, x, y, width) {
  const sourceWidth = Number(logo?.naturalWidth || logo?.width || 0);
  const sourceHeight = Number(logo?.naturalHeight || logo?.height || 0);
  if (!sourceWidth || !sourceHeight) return;
  const format = String(logo?.src || "").toLowerCase().endsWith(".jpg") ? "JPEG" : "PNG";
  doc.addImage(logo, format, x, y, width, width * (sourceHeight / sourceWidth));
}

async function loadLogo() {
  const logo = new Image();
  logo.crossOrigin = "anonymous";
  logo.src = `${import.meta.env.BASE_URL}images/logossinfondo.png`;
  await new Promise((resolve) => { logo.onload = resolve; logo.onerror = resolve; });
  return logo;
}

function drawHeader(doc, logo, quote, page, title, subtitle) {
  drawTopBand(doc);
  addLogo(doc, logo, 20, 13, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, 70, 32.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...COLORS.steel);
  doc.text(subtitle, 70, 39.5);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text(`Cotización • ${documentDate(quote?.departure_at || quote?.created_at)}`, 190, 33, { align: "right" });
  doc.setDrawColor(...COLORS.line);
  doc.line(20, 47.5, 190, 47.5);
  drawFrameAndFooter(doc, page, 4);
}

function drawSectionTitle(doc, title, y) {
  doc.setFillColor(...COLORS.gold);
  doc.roundedRect(20, y - 3.5, 2.1, 7, 0.8, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, 25, y + 1);
}

function drawPair(doc, label, item, x, y, width) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.steel);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  const lines = doc.splitTextToSize(value(item), width);
  doc.text(lines, x, y + 5.2);
  return lines.length;
}

function drawCard(doc, title, rows, x, y, width, height) {
  doc.setFillColor(...COLORS.gold);
  doc.rect(x, y - 1.8, width, 1.8, "F");
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, x + 6, y + 8.5);
  let cursorY = y + 17;
  rows.forEach(([label, item]) => {
    cursorY += 6.5 + drawPair(doc, label, item, x + 6, cursorY, width - 12) * 3.2;
  });
}

function drawTable(doc, columns, rows, y, widths) {
  doc.setFillColor(...COLORS.navy);
  doc.rect(20, y, PAGE.contentWidth, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  doc.setTextColor(...COLORS.white);
  let x = 23;
  columns.forEach((column, index) => { doc.text(column, x, y + 5.8); x += widths[index]; });
  rows.forEach((row, rowIndex) => {
    const rowY = y + 9 + rowIndex * 10;
    doc.setFillColor(...(rowIndex % 2 ? COLORS.row : COLORS.white));
    doc.rect(20, rowY, PAGE.contentWidth, 10, "F");
    doc.setDrawColor(...COLORS.line);
    doc.rect(20, rowY, PAGE.contentWidth, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(...COLORS.ink);
    x = 23;
    row.forEach((item, index) => { doc.text(value(item), x, rowY + 6.2); x += widths[index]; });
  });
  return y + 9 + rows.length * 10;
}

function drawCargoInformationTable(doc, y) {
  const rows = [
    ["Volumen de equipaje interno", "40 ft3 (1.13 m3)"],
    ["Payload con combustible lleno (referencia del modelo)", "1,992 lb (aprox. 904 kg)"],
    ["Payload máximo (referencia del modelo)", "3,190 lb (aprox. 1,447 kg)"],
    [
      "Carga recomendada",
      "Mensajería y paquetería exprés, documentos, componentes, refacciones y mercancía de alta prioridad, sujeta a peso, dimensiones y configuración de la aeronave.",
    ],
  ];
  const rowHeights = [10, 10, 10, 21];
  const columnWidths = [70, 100];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text("INFORMACIÓN DE CARGA - MENSAJERÍA Y PAQUETERÍA", 20, y - 7);

  doc.setFillColor(...COLORS.gold);
  doc.rect(20, y, PAGE.contentWidth, 9, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.white);
  doc.text("CONCEPTO", 23, y + 5.8);
  doc.text("CAPACIDAD / REFERENCIA", 93, y + 5.8);

  let rowY = y + 9;
  rows.forEach((row, index) => {
    const height = rowHeights[index];
    doc.setFillColor(...(index % 2 ? COLORS.row : COLORS.white));
    doc.rect(20, rowY, PAGE.contentWidth, height, "F");
    doc.setDrawColor(...COLORS.line);
    doc.rect(20, rowY, PAGE.contentWidth, height);
    doc.line(20 + columnWidths[0], rowY, 20 + columnWidths[0], rowY + height);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.7);
    doc.setTextColor(...COLORS.ink);
    doc.text(doc.splitTextToSize(row[0], columnWidths[0] - 6), 23, rowY + 6.2);
    doc.text(doc.splitTextToSize(row[1], columnWidths[1] - 6), 93, rowY + 6.2);
    rowY += height;
  });

  return rowY;
}

function drawBullets(doc, items, y) {
  let cursorY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...COLORS.ink);
  items.forEach((item) => {
    const lines = doc.splitTextToSize(item, 157);
    doc.setFillColor(...COLORS.gold);
    doc.circle(22, cursorY - 1.2, 0.9, "F");
    doc.text(lines, 26, cursorY);
    cursorY += lines.length * 3.8 + 4;
  });
  return cursorY;
}

function drawTerms(doc, terms, y) {
  let cursorY = y;
  terms.forEach(([heading, body]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    doc.setTextColor(...COLORS.ink);
    doc.text(heading, 20, cursorY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(body, PAGE.contentWidth);
    doc.text(lines, 20, cursorY + 4.2);
    cursorY += lines.length * 3.3 + 7.5;
  });
}

function drawCargoTermsHeader(doc) {
  drawTopBand(doc);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(9.5, 9.5, PAGE.width - 19, PAGE.height - 19);
  doc.setDrawColor(...COLORS.navy);
  doc.line(14, 274.5, PAGE.width - 14, 274.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.steelSoft);
  doc.text("RED AVIATION COMPANY | ventas@redaviationcorp.com | redskyg.com/mx", 14, 280);
  doc.text("Página 4 de 4", PAGE.width - 11, 280, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.navy);
  doc.text("TÉRMINOS Y CONDICIONES", PAGE.width / 2, 23, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.steel);
  doc.text("Condiciones aplicables a la propuesta de operación de carga", 20, 32);
}

export function getCargoQuotePdfFileName(quote) {
  return `COTIZACION-CARGA-${routeFromQuote(quote).replace(/[^a-z0-9]+/gi, "-")}.pdf`;
}

export async function generateCargoQuotePdf(quote) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = await loadLogo();
  const route = routeFromQuote(quote);
  const aircraft = value(quote?.aircraft_name, "LEARJET 35");

  drawHeader(doc, logo, quote, 1, "Cotización de Vuelo de Carga", "Aviación profesional de carga");
  drawCard(doc, "Información del Cliente", [
    ["Nombre", value(quote?.full_name || quote?.client_name, "A QUIEN CORRESPONDA")],
    ["Correo", quote?.email || quote?.client_email],
    ["Teléfono", quote?.phone || quote?.client_phone],
  ], 20, 57, 82, 60);
  drawCard(doc, "Perfil de Carga", [
    ["Aeronave", aircraft],
    ["Ruta", route],
    ["Fecha de salida", documentDate(quote?.departure_at)],
    ["Operación", "Operación de carga"],
  ], 108, 57, 82, 60);
  drawSectionTitle(doc, "Tramos de Vuelo", 133);
  const tableEnd = drawTable(doc, ["DÍA", "RUTA", "TRAMOS"], [
    ["Lunes", route, "2"], ["Martes", route, "2"], ["Miércoles", route, "2"],
    ["Jueves", route, "2"], ["Viernes", route, "2"],
  ], 140, [38, 106, 26]);
  drawSectionTitle(doc, "Resumen Comercial", tableEnd + 13);
  drawCard(doc, "Resumen de Operación", [
    ["Total de tramos", "10 tramos"],
    ["Pernoctas", "4 noches en base"],
    ["Moneda", "USD"],
  ], 20, tableEnd + 20, 82, 45);
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(108, tableEnd + 18.2, 82, 46.8, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.white);
  doc.text("TOTAL ESTIMADO DE LA OPERACIÓN", 114, tableEnd + 31);
  doc.setFontSize(15);
  doc.setTextColor(...COLORS.gold);
  doc.text(money(quote?.total_usd), 184, tableEnd + 44, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.white);
  doc.text("Estimado en USD, sujeto a confirmación del itinerario", 114, tableEnd + 56);

  doc.addPage();
  drawHeader(doc, logo, quote, 2, "Cotización de Vuelo de Carga", "Aviación profesional de carga");
  drawSectionTitle(doc, "Alcance del Servicio", 63);
  drawCard(doc, "RED AVIATION / OPERADOR", [
    ["Incluye", "Disponibilidad de aeronave y tripulación asignada"],
    ["Incluye", "Ejecución de vuelos conforme al itinerario"],
    ["Incluye", "Coordinación operacional de la aeronave"],
  ], 20, 70, 82, 75);
  drawCard(doc, "CLIENTE / EMBARCADOR", [
    ["Responsable de", "Entrega de carga a la aeronave"],
    ["Responsable de", "Carga, descarga y handling"],
    ["Responsable de", "Gastos, almacenaje, permisos y documentación"],
  ], 108, 70, 82, 75);
  drawSectionTitle(doc, "Notas Comerciales", 163);
  drawBullets(doc, [
    "La disponibilidad de aeronave está sujeta a confirmación al momento de aceptar la propuesta.",
    "Las modificaciones de itinerario pueden afectar el precio, la disponibilidad y las condiciones operativas.",
    "La carga debe estar correctamente embalada, identificada y acompañada de la documentación aplicable.",
    "Las mercancías restringidas o peligrosas requieren revisión y autorización previa por escrito.",
  ], 171);

  doc.addPage();
  drawHeader(doc, logo, quote, 3, "Cotización de Vuelo de Carga", "Referencia técnica de la aeronave");
  drawSectionTitle(doc, `${aircraft.toUpperCase()} - Capacidad de Carga`, 63);
  drawTable(doc, ["DIMENSIÓN DE CABINA", "REFERENCIA"], [
    ["Longitud de cabina", "3.94 m"], ["Ancho máximo", "1.50 m"], ["Altura de cabina", "1.32 m"],
    ["Volumen de cabina", "268 ft3 / 7.59 m3"], ["Puerta principal", "0.91 m x 1.27 m"],
    ["Equipaje interno", "40 ft3 / 1.13 m3"],
  ], 70, [92, 78]);
  drawCargoInformationTable(doc, 163);
  drawSectionTitle(doc, "Aviso Técnico", 230);
  drawBullets(doc, ["Todas las dimensiones y capacidades son referencias generales. La capacidad final depende de matrícula, combustible, Weight & Balance, límites estructurales, dimensiones de la carga y autorización del operador."], 238);

  doc.addPage();
  drawCargoTermsHeader(doc);
  drawTerms(doc, [
    ["1. OBJETO DEL SERVICIO", `Operación aérea en ${aircraft} conforme al itinerario indicado, orientada al transporte de mensajería y paquetería permitida, sujeto a configuración, capacidad y autorizaciones aplicables.`],
    ["2. DISPONIBILIDAD Y CONFIRMACIÓN", "Sujeta a disponibilidad de aeronave, tripulación, permisos y condiciones operativas al momento de la confirmación."],
    ["3. ITINERARIO Y MODIFICACIONES", "Cambios de ruta, horarios, fechas, aeropuertos, sectores, esperas o requerimientos adicionales podrán generar recotización y cargos adicionales."],
    ["4. ALCANCE Y SERVICIOS AEROPORTUARIOS", "La tarifa contempla aeronave y tripulación. El cliente será responsable de coordinar y cubrir el traslado de la mercancía hasta la aeronave, carga y descarga, handling de carga, gastos aeroportuarios asociados, almacenaje, custodia, maniobras especiales y demás servicios terrestres requeridos."],
    ["5. CARGA, PESO Y DIMENSIONES", "Toda carga deberá declararse previamente con contenido, peso, dimensiones, piezas y embalaje. Su aceptación dependerá del Weight & Balance, límites estructurales, acceso y criterio del operador."],
    ["6. MERCANCÍAS RESTRINGIDAS O PELIGROSAS", "No se aceptarán sustancias ilegales, explosivos, armas, municiones ni artículos prohibidos. Mercancías peligrosas o reguladas requerirán declaración previa y autorizaciones correspondientes."],
    ["7. EMBALAJE Y ASEGURAMIENTO", "El embarcador deberá entregar la mercancía debidamente embalada, identificada y protegida. La carga deberá poder asegurarse para evitar desplazamientos."],
    ["8. DOCUMENTACIÓN", "El cliente proporcionará oportunamente la documentación comercial, fiscal, aduanera, de seguridad o transporte que resulte aplicable."],
    ["9. COSTOS ADICIONALES", "Gastos extraordinarios por cambios, esperas no previstas, permisos especiales, servicios adicionales, maniobras, almacenaje o requerimientos no contemplados serán cotizados por separado."],
    ["10. CONDICIONES OPERATIVAS", "La operación está sujeta a condiciones meteorológicas, aeroportuarias, regulatorias, técnicas y de seguridad. El comandante y operador conservarán autoridad operacional."],
    ["11. CANCELACIONES", "Las condiciones y penalizaciones aplicables serán las establecidas al momento de la confirmación contractual. Toda cancelación deberá notificarse por escrito."],
    ["12. RESPONSABILIDAD SOBRE EL CONTENIDO", "El cliente declara que la descripción de la mercancía es completa y veraz y responderá por información falsa, incompleta o mercancía no declarada."],
    ["13. VIGENCIA DE LA PROPUESTA", "Esta cotización es informativa y no constituye reserva definitiva. Precio, disponibilidad y condiciones deberán reconfirmarse al contratar."],
  ], 47);

  return doc;
}
