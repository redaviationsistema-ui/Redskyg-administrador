export const TEMPLATE_VARIABLES = Object.freeze([
  "client_name", "company_name", "advisor_name", "advisor_phone", "advisor_email",
  "aircraft_model", "aircraft_registration", "part_number", "route", "flight_date",
  "passengers", "quotation_number", "quotation_amount", "currency", "email", "whatsapp",
]);

const VARIABLE_PRESENTATION = {
  client_name: ["👤", "Nombre del cliente", "Client name"],
  company_name: ["🏢", "Nombre de la empresa", "Company name"],
  advisor_name: ["🧑‍💼", "Nombre del asesor", "Advisor name"],
  advisor_phone: ["☎", "Teléfono del asesor", "Advisor phone"],
  advisor_email: ["✉", "Correo del asesor", "Advisor email"],
  aircraft_model: ["✈", "Modelo de aeronave", "Aircraft model"],
  aircraft_registration: ["🔤", "Matrícula", "Aircraft registration"],
  part_number: ["🔧", "Número de parte", "Part number"],
  route: ["📍", "Ruta", "Route"],
  flight_date: ["📅", "Fecha del vuelo", "Flight date"],
  passengers: ["👥", "Pasajeros", "Passengers"],
  quotation_number: ["📄", "Número de cotización", "Quotation number"],
  quotation_amount: ["$", "Importe", "Amount"],
  currency: ["USD", "Moneda", "Currency"],
  email: ["✉", "Correo del cliente", "Client email"],
  whatsapp: ["💬", "WhatsApp del cliente", "Client WhatsApp"],
};

export const TEMPLATE_PREVIEW_VALUES = Object.freeze({
  client_name: "Kevin de Jesús", company_name: "Red Aviation", advisor_name: "Luis Guasso",
  advisor_phone: "+52 722 112 6671", advisor_email: "advisor@redaviation.com",
  aircraft_model: "Gulfstream G-IV", aircraft_registration: "XA-ABC", part_number: "822-1120-005",
  route: "Toluca – Guadalajara – Toluca", flight_date: "15 de agosto de 2026", passengers: "6",
  quotation_number: "Q-2026-001", quotation_amount: "38,322.50", currency: "USD",
  email: "cliente@empresa.com", whatsapp: "+52 722 000 0000",
});

export function getTemplateVariableOptions(language = "es") {
  return TEMPLATE_VARIABLES.map((key) => ({
    key,
    token: `{{${key}}}`,
    icon: VARIABLE_PRESENTATION[key][0],
    label: VARIABLE_PRESENTATION[key][language === "en" ? 2 : 1],
  }));
}

export function technicalContentToDisplay(content = "", language = "es") {
  let result = String(content);
  for (const option of getTemplateVariableOptions(language)) {
    result = result.replaceAll(option.token, `[${option.label}]`);
  }
  return result;
}

export function displayContentToTechnical(content = "") {
  let result = String(content);
  for (const language of ["es", "en"]) {
    for (const option of getTemplateVariableOptions(language)) {
      result = result.replaceAll(`[${option.label}]`, option.token);
    }
  }
  return result;
}

const VARIABLE_PATTERN = /{{\s*([a-z_][a-z0-9_]*)\s*}}/gi;

export function extractTemplateVariables(content = "") {
  const found = new Set();
  for (const match of String(content).matchAll(VARIABLE_PATTERN)) found.add(match[1].toLowerCase());
  return [...found];
}

export function validateTemplateVariables(content = "") {
  const allowed = new Set(TEMPLATE_VARIABLES);
  return extractTemplateVariables(content).filter((name) => !allowed.has(name));
}

export function renderTemplate(content = "", values = {}) {
  const normalized = Object.fromEntries(
    Object.entries(values || {}).map(([key, value]) => [key.toLowerCase(), value == null ? "" : String(value)]),
  );
  const pending = new Set();
  const invalid = new Set();
  const allowed = new Set(TEMPLATE_VARIABLES);
  const message = String(content).replace(VARIABLE_PATTERN, (token, rawName) => {
    const name = rawName.toLowerCase();
    if (!allowed.has(name)) {
      invalid.add(name);
      return token;
    }
    const value = normalized[name]?.trim();
    if (!value) {
      pending.add(name);
      return `{{${name}}}`;
    }
    return normalized[name];
  });
  return { message, pending: [...pending], invalid: [...invalid] };
}

export function insertVariableAtCursor(element, value, variable) {
  const token = variable.startsWith("{{") || variable.startsWith("[") ? variable : `{{${variable}}}`;
  const start = element?.selectionStart ?? value.length;
  const end = element?.selectionEnd ?? start;
  return { value: `${value.slice(0, start)}${token}${value.slice(end)}`, cursor: start + token.length };
}
