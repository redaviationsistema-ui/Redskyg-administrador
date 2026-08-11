export const EXPERIENCE_FILE_RULES = Object.freeze({
  accept: Object.freeze(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  maxBytes: 15 * 1024 * 1024,
});

export function validateExperienceFile(file) {
  if (!EXPERIENCE_FILE_RULES.accept.includes(file.type)) return "Formato no permitido.";
  if (file.size > EXPERIENCE_FILE_RULES.maxBytes) return "La imagen supera el límite de 15 MB.";
  return "";
}

export function slugifyVillaName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
