export const BULK_EMAIL_ATTACHMENT_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const UNSUPPORTED_FILE_MESSAGE =
  "Formato no permitido. Solo se permiten imágenes JPG, PNG, WEBP o archivos PDF.";
const EXTENSION_MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export function getFileExtension(fileName = "") {
  const normalized = String(fileName || "").toLowerCase().trim();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

export function isCampaignPdf(file = {}) {
  return file?.type === "application/pdf" || getFileExtension(file?.name || file?.path || file) === ".pdf";
}

export function isCampaignImage(file = {}) {
  return ACCEPTED_MIME_TYPES.includes(file?.type) && String(file.type).startsWith("image/");
}

export function validateCampaignAttachment(file) {
  if (!file) {
    return "";
  }

  const extension = getFileExtension(file.name);
  if (!ACCEPTED_MIME_TYPES.includes(file.type) || EXTENSION_MIME_TYPES[extension] !== file.type) {
    return UNSUPPORTED_FILE_MESSAGE;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "El archivo no puede exceder 10 MB.";
  }

  return "";
}
