export const AIRCRAFT_SALES_FILE_RULES = Object.freeze({
  accept: Object.freeze(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  maxBytes: 15 * 1024 * 1024,
});

export const AIRCRAFT_SALES_PDF_RULES = Object.freeze({
  accept: "application/pdf",
  maxBytes: 50 * 1024 * 1024,
});

export function validateAircraftSalesFile(file) {
  if (!AIRCRAFT_SALES_FILE_RULES.accept.includes(file.type)) return "Formato no permitido.";
  if (file.size > AIRCRAFT_SALES_FILE_RULES.maxBytes) return "La imagen supera el limite de 15 MB.";
  return "";
}

export function validateAircraftSalesPdf(file) {
  if (!file) return "Selecciona un archivo PDF.";
  if (file.type !== AIRCRAFT_SALES_PDF_RULES.accept && !file.name.toLowerCase().endsWith(".pdf")) return "El documento debe ser un PDF.";
  if (file.size > AIRCRAFT_SALES_PDF_RULES.maxBytes) return "El PDF no puede exceder 50 MB.";
  return "";
}

export function slugifyAircraftSale(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildAircraftSaleSlug(name, registration) {
  return slugifyAircraftSale([name, registration].filter(Boolean).join(" "));
}
