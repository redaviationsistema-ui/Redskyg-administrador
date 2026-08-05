export const ALLOWED_REFERENCE_TYPES = new Set(["lead", "client", "quotation", "flight", "aircraft", "part"]);

export function normalizeReference(type, id) {
  const normalizedType = typeof type === "string" ? type.trim().toLowerCase() : "";
  const normalizedId = id == null ? "" : String(id).trim();
  if (!ALLOWED_REFERENCE_TYPES.has(normalizedType) || !normalizedId) {
    return { reference_type: null, reference_id: null };
  }
  return { reference_type: normalizedType, reference_id: normalizedId };
}
