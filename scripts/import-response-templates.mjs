import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const workbookPath = process.argv[2];
if (!workbookPath || !fs.existsSync(workbookPath)) {
  throw new Error("Uso: npm run import:response-templates -- /ruta/RESPUESTAS\\ RED.xlsx");
}
const url = process.env.SUPABASE_INVENTORY_URL || process.env.VITE_SUPABASE_URL2;
const key = process.env.SUPABASE_INVENTORY_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Define SUPABASE_INVENTORY_URL (o VITE_SUPABASE_URL2) y SUPABASE_INVENTORY_SERVICE_ROLE_KEY.");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const workbook = XLSX.readFile(workbookPath, { cellText: true, cellDates: false });
const sheetConfig = { "RESPUESTAS SKY MX": { region: "MX", language: "es" }, "RESPUESTA USA": { region: "USA", language: "en" } };
const aliases = {
  category: ["categoria", "categoría", "category", "tipo"], name: ["nombre", "name", "titulo", "título"],
  content: ["respuesta", "response", "mensaje", "message", "contenido", "content", "texto"],
  channel: ["canal", "channel", "medio"], subject: ["asunto", "subject"], description: ["descripcion", "descripción", "description"],
};
const normalize = (value) => String(value ?? "").trim();
const keyName = (value) => normalize(value).toLowerCase();
const pick = (row, field) => {
  const entry = Object.entries(row).find(([key]) => aliases[field].includes(keyName(key)));
  return normalize(entry?.[1]);
};
const slugify = (value) => normalize(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const parseChannels = (value) => {
  const supported = ["WhatsApp", "Email", "Instagram", "Llamada", "Web"];
  const parts = normalize(value).split(/[,/;|]+/).map(keyName);
  const found = supported.filter((item) => parts.includes(item.toLowerCase()));
  return found.length ? found : ["WhatsApp"];
};

let imported = 0;
for (const [sheetName, config] of Object.entries(sheetConfig)) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`No existe la hoja requerida: ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  for (const [index, row] of rows.entries()) {
    const categoryName = pick(row, "category");
    const content = pick(row, "content");
    if (!categoryName || !content) continue;
    const { data: category, error: categoryError } = await supabase.from("response_template_categories").select("id").eq("region", config.region).ilike("name", categoryName).maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) throw new Error(`${sheetName}, fila ${index + 2}: categoría desconocida “${categoryName}”.`);
    const name = pick(row, "name") || `${categoryName} ${index + 1}`;
    const sourceKey = `${sheetName}-${index + 2}-${name}`;
    const slug = `xlsx-${slugify(sourceKey)}`.slice(0, 180);
    const payload = { name, slug, description: pick(row, "description"), category_id: category.id, region: config.region, language: config.language, subject: pick(row, "subject") || null, content, channels: parseChannels(pick(row, "channel")), status: "active", display_order: index * 10 };
    const { error } = await supabase.from("response_templates").upsert(payload, { onConflict: "slug" });
    if (error) throw new Error(`${sheetName}, fila ${index + 2}: ${error.message}`);
    imported += 1;
  }
}
console.log(`Importación idempotente terminada: ${imported} plantillas procesadas desde ${path.basename(workbookPath)}.`);
