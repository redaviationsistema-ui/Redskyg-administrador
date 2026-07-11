import { supabase } from "@/supabase";

const LOOKBOOKS_BUCKET = "lookbooks";
const COVER_FOLDER = "covers";
const PDF_FOLDER = "documents";

function normalizeStoragePath(path = "") {
  return String(path).replace(/^\/+/, "");
}

function isRemoteUrl(value = "") {
  return /^https?:\/\//i.test(String(value));
}

function buildUploadPath(folder, slug, fileName) {
  const safeSlug = String(slug || "lookbook")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lookbook";

  const safeFileName = String(fileName || "file")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "");

  return `${folder}/${safeSlug}/${Date.now()}-${safeFileName}`;
}

export function getLookbookBucketName() {
  return LOOKBOOKS_BUCKET;
}

export function isStoragePath(value = "") {
  return Boolean(value) && !isRemoteUrl(value) && !String(value).startsWith("data:");
}

export function slugifyLookbook(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatFileSizeInMb(bytes = 0) {
  const sizeInMb = Number(bytes) / (1024 * 1024);
  return Number(sizeInMb.toFixed(2));
}

export function createPdfUploadPath(slug, fileName) {
  return buildUploadPath(PDF_FOLDER, slug, fileName);
}

export function createCoverUploadPath(slug, fileName) {
  return buildUploadPath(COVER_FOLDER, slug, fileName);
}

export async function listLookbooks() {
  const { data, error } = await supabase
    .from("lookbooks")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function createLookbook(payload) {
  const { error } = await supabase.from("lookbooks").insert(payload);

  if (error) {
    error.code = error.code || "LOOKBOOK_INSERT_FAILED";
    error.stage = "database_insert";
    throw error;
  }
}

export async function updateLookbook(id, payload) {
  const { error } = await supabase
    .from("lookbooks")
    .update(payload)
    .eq("id", id);

  if (error) {
    error.stage = "database_update";
    throw error;
  }
}

export async function updateLookbookStatus(id, isActive) {
  const { error } = await supabase
    .from("lookbooks")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteLookbook(id) {
  const { error } = await supabase.from("lookbooks").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function reorderLookbooks(items) {
  const normalizedItems = items.map((item, index) => ({
    id: item.id,
    order_index: index + 1,
  }));

  const responses = await Promise.all(
    normalizedItems.map((item) =>
      supabase.from("lookbooks").update({ order_index: item.order_index }).eq("id", item.id),
    ),
  );

  const failedResponse = responses.find((response) => response.error);
  if (failedResponse?.error) {
    throw failedResponse.error;
  }
}

export async function createSignedAssetUrl(path, expiresIn = 3600) {
  if (!path) {
    return "";
  }

  if (isRemoteUrl(path)) {
    return path;
  }

  const { data, error } = await supabase.storage
    .from(LOOKBOOKS_BUCKET)
    .createSignedUrl(normalizeStoragePath(path), expiresIn);

  if (error) {
    throw error;
  }

  return data?.signedUrl || "";
}

export async function uploadLookbookPdf({ file, aircraftSlug, onProgress }) {
  if (!file) {
    throw new Error("Debes seleccionar un archivo PDF.");
  }

  if (file.type !== "application/pdf") {
    throw new Error("El archivo debe ser un PDF válido.");
  }

  const path = createPdfUploadPath(aircraftSlug, file.name);
  onProgress?.(15);

  const { data, error } = await supabase.storage
    .from(LOOKBOOKS_BUCKET)
    .upload(normalizeStoragePath(path), file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

  if (error) {
    error.stage = "storage_upload";
    error.filePath = normalizeStoragePath(path);
    throw error;
  }

  onProgress?.(100);

  return data?.path || normalizeStoragePath(path);
}

export async function uploadFileWithProgress({ file, path, onProgress }) {
  onProgress?.(15);

  const { data, error } = await supabase.storage
    .from(LOOKBOOKS_BUCKET)
    .upload(normalizeStoragePath(path), file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

  if (error) {
    error.stage = "storage_upload";
    error.filePath = normalizeStoragePath(path);
    throw error;
  }

  onProgress?.(100);

  return data?.path || normalizeStoragePath(path);
}

export async function removeStoredFiles(paths = []) {
  const uniquePaths = [...new Set(paths.filter((path) => isStoragePath(path)).map(normalizeStoragePath))];

  if (!uniquePaths.length) {
    return;
  }

  const { error } = await supabase.storage.from(LOOKBOOKS_BUCKET).remove(uniquePaths);

  if (error) {
    throw error;
  }
}
