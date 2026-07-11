import { supabaseInventory } from "@/supabase";

const BULK_EMAIL_IMAGES_BUCKET = "bulk-email-images";
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function sanitizeSegment(value = "", fallback = "image") {
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

export function validateCampaignImage(file) {
  if (!file) {
    return "";
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return "La imagen debe ser JPG, JPEG, PNG, WEBP o GIF.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "La imagen no puede exceder 5 MB.";
  }

  return "";
}

function buildFilePath(campaignId, fileName) {
  const safeFileName = sanitizeSegment(fileName || "image", "image");
  const safeCampaignId = sanitizeSegment(campaignId || "draft", "draft");
  return `${Date.now()}-${safeCampaignId}-${safeFileName}`;
}

export async function uploadCampaignImage({ campaignId, file }) {
  const validation = validateCampaignImage(file);
  if (validation) {
    throw new Error(validation);
  }

  const filePath = buildFilePath(campaignId, file.name);
  const { data, error } = await supabaseInventory.storage
    .from(BULK_EMAIL_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    throw error;
  }

  const storedPath = data?.path || filePath;
  return {
    path: storedPath,
    url: await getCampaignImageUrl(storedPath),
  };
}

export async function uploadCampaignImages({ campaignId, files = [] }) {
  const uploads = [];
  for (const file of files) {
    uploads.push(await uploadCampaignImage({ campaignId, file }));
  }
  return uploads;
}

export async function deleteCampaignImage(path = "") {
  if (!path) {
    return;
  }

  const normalized = String(path).replace(/^\/+/, "");
  const { error } = await supabaseInventory.storage.from(BULK_EMAIL_IMAGES_BUCKET).remove([normalized]);
  if (error) {
    throw error;
  }
}

export async function getCampaignImageUrl(path = "") {
  if (!path) {
    return "";
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = String(path).replace(/^\/+/, "");

  const { data: signedData, error } = await supabaseInventory.storage
    .from(BULK_EMAIL_IMAGES_BUCKET)
    .createSignedUrl(normalizedPath, 3600);

  if (!error && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  const { data } = supabaseInventory.storage.from(BULK_EMAIL_IMAGES_BUCKET).getPublicUrl(normalizedPath);
  return data?.publicUrl || "";
}
