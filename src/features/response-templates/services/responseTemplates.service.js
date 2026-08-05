import { supabaseInventory as database } from "@/supabase";
import { TEMPLATE_VARIABLES, renderTemplate, validateTemplateVariables } from "../utils/templateVariables";
import { ALLOWED_REFERENCE_TYPES, normalizeReference } from "../utils/usageReference";
export { calculateEstimatedCost, formatMinutes } from "../utils/usageCosts";

const TEMPLATE_COLUMNS = "id,name,slug,description,category,region,language,channels,subject,content,variables,status,display_order,version,created_at,updated_at,deleted_at";
export const REGIONS = ["MX", "USA"];
export const LANGUAGES = ["es", "en"];
export const CHANNELS = ["whatsapp", "email", "instagram", "web", "phone", "copy"];
export const STATUSES = ["active", "inactive", "draft", "archived"];
export { ALLOWED_REFERENCE_TYPES, normalizeReference };

export function slugify(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function cleanPayload(input) {
  const order = Number(input.display_order);
  const channels = [...new Set((input.channels || []).filter((item) => CHANNELS.includes(item)))];
  const payload = {
    name: String(input.name || "").trim(), slug: slugify(input.slug || input.name),
    description: String(input.description || "").trim(), category: String(input.category || "").trim(),
    region: input.region, language: input.language, channels,
    subject: String(input.subject || "").trim() || null, content: String(input.content || "").trim(),
    variables: [...new Set(input.variables || [])], status: input.status, display_order: order,
  };
  const missing = ["name", "category", "region", "language", "content"].filter((key) => !payload[key]);
  if (!channels.length) missing.push("channels");
  if (missing.length) throw new Error("Completa todos los campos obligatorios.");
  if (!REGIONS.includes(payload.region) || !LANGUAGES.includes(payload.language) || !STATUSES.includes(payload.status)) throw new Error("Una opción seleccionada no es válida.");
  if (!Number.isInteger(order) || order < 0) throw new Error("El orden debe ser un entero igual o mayor que cero.");
  if (payload.content.length > 20000) throw new Error("El contenido no puede exceder 20,000 caracteres.");
  const invalidVariables = validateTemplateVariables(`${payload.subject || ""} ${payload.content}`);
  if (invalidVariables.length) throw new Error(`Variables no permitidas: ${invalidVariables.join(", ")}.`);
  return payload;
}

export async function listTemplates(filters = {}) {
  let query = database.from("response_templates").select(TEMPLATE_COLUMNS)
    .eq("region", filters.region).is("deleted_at", null)
    .order("display_order", { ascending: true }).order("created_at", { ascending: false });
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.channel) query = query.contains("channels", [filters.channel]);
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createTemplate(input) {
  const { data, error } = await database.from("response_templates").insert(cleanPayload(input)).select(TEMPLATE_COLUMNS).single();
  if (error) throw error;
  return data;
}
export async function updateTemplate(id, input) {
  const { data, error } = await database.from("response_templates").update(cleanPayload(input)).eq("id", id).select(TEMPLATE_COLUMNS).single();
  if (error) throw error;
  return data;
}
export async function deleteTemplate(id) {
  const { error } = await database.from("response_templates").update({ deleted_at: new Date().toISOString(), status: "archived" }).eq("id", id);
  if (error) throw error;
}

export async function getDatabaseSession() {
  const { data, error } = await database.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function recordTemplateUse(payload) {
  const normalizedReference = normalizeReference(payload?.reference_type, payload?.reference_id);
  const safePayload = {
    ...payload,
    reference_type: normalizedReference.reference_type,
    reference_id: normalizedReference.reference_id,
  };
  const { data, error } = await database.from("response_template_usages").insert(safePayload)
    .select("id,template_id,reference_type,reference_id,duration_minutes,hourly_rate,currency,calculated_cost,used_at").single();
  if (error) {
    console.error("[Template usage insert error]", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    throw error;
  }
  return data;
}

export async function updateTemplateUsage(id, payload) {
  const { data, error } = await database.from("response_template_usages").update(payload).eq("id", id)
    .select("id,template_id,duration_minutes,hourly_rate,currency,calculated_cost,used_at").single();
  if (error) throw error;
  if (!data?.id) throw new Error("Supabase no actualizó el registro. Verifica la política UPDATE de response_template_usages.");
  return data;
}

export async function deleteTemplateUsage(id) {
  const { data, error } = await database.from("response_template_usages").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!Array.isArray(data) || !data.some((row) => row.id === id)) {
    throw new Error("Supabase no eliminó el registro. La política DELETE de response_template_usages está bloqueando la operación.");
  }
  return data[0];
}

export async function listUsageHistory(filters = {}) {
  let query = database.from("response_template_usages").select(`id,template_id,user_name,user_email,recipient_name,recipient_contact,channel,duration_minutes,hourly_rate,currency,calculated_cost,action,delivery_status,notes,used_at,response_templates(id,name,category,region,language)`)
    .order("used_at", { ascending: false });
  if (filters.start) query = query.gte("used_at", filters.start);
  if (filters.end) query = query.lt("used_at", filters.end);
  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.user) query = query.eq("user_email", filters.user);
  const { data, error } = await query;
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return filters.region ? rows.filter((row) => row.response_templates?.region === filters.region) : rows;
}

export async function getMonthlyTotals(month) {
  const { data, error } = await database.from("response_template_monthly_totals")
    .select("month,currency,total_usages,total_minutes,total_hours,final_cost").eq("month", month);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export function previewTemplate(content, values) { return renderTemplate(content, values); }
export function getAllowedVariables() { return [...TEMPLATE_VARIABLES]; }
