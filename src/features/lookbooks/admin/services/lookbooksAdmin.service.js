import { supabase } from "@/supabase";

export const LOOKBOOK_COVERS_BUCKET = "lookbook-covers";
export const LOOKBOOK_PDFS_BUCKET = "lookbook-pdfs";

export const LOOKBOOK_CATEGORY_OPTIONS = [
  "Helicóptero",
  "Monomotor Pistón",
  "Turbohélice",
  "Light Jet",
  "Mid Jet",
  "Super Mid",
  "Heavy Jet",
  "Regional Jet",
];

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const COVER_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_COVER_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

function sanitizeSegment(value = "", fallback = "archivo") {
  const normalized = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function normalizeStoragePath(path = "") {
  return String(path || "").replace(/^\/+/, "");
}

function isHttpUrl(value = "") {
  return /^https?:\/\//i.test(String(value || ""));
}

function getDownloadsCountMap(records = []) {
  return records.reduce((accumulator, item) => {
    const key = item?.lookbook_id;
    if (!key) {
      return accumulator;
    }

    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function applyLookbookOrder(query, order = "manual_asc") {
  switch (order) {
    case "manual_desc":
      return query.order("order_index", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    case "published_desc":
      return query.order("created_at", { ascending: false }).order("order_index", { ascending: true, nullsFirst: false });
    case "published_asc":
      return query.order("created_at", { ascending: true }).order("order_index", { ascending: true, nullsFirst: false });
    case "title_asc":
      return query.order("title", { ascending: true }).order("created_at", { ascending: false });
    case "title_desc":
      return query.order("title", { ascending: false }).order("created_at", { ascending: false });
    case "manual_asc":
    default:
      return query.order("order_index", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  }
}

function buildStoragePath({ slug, fileName }) {
  const safeSlug = sanitizeSegment(slug || "lookbook", "lookbook");
  const safeFileName = sanitizeSegment(fileName || "archivo", "archivo");
  return `${safeSlug}/${Date.now()}-${safeFileName}`;
}

export function slugifyLookbook(value = "") {
  return sanitizeSegment(value, "lookbook").replace(/\.+/g, "-");
}

export function formatFileSizeInMb(bytes = 0) {
  return Number((Number(bytes || 0) / (1024 * 1024)).toFixed(2));
}

export function formatBytes(bytes = 0) {
  const size = Number(bytes || 0);
  if (!size) {
    return "0 MB";
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${formatFileSizeInMb(size)} MB`;
}

export function validateCoverFile(file) {
  if (!file) {
    return "";
  }

  const validType = COVER_TYPES.includes(file.type);
  const validExtension = COVER_EXTENSIONS.some((extension) =>
    file.name.toLowerCase().endsWith(extension),
  );

  if (!validType && !validExtension) {
    return "La portada debe estar en formato JPG, JPEG, PNG o WEBP.";
  }

  if (file.size > MAX_COVER_SIZE_BYTES) {
    return "La portada no puede exceder 4 MB.";
  }

  return "";
}

export function validatePdfFile(file) {
  if (!file) {
    return "";
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return "El documento debe estar en formato PDF.";
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return "El PDF no puede exceder 50 MB.";
  }

  return "";
}

export function extractCoverStoragePath(coverUrl = "") {
  if (!coverUrl) {
    return "";
  }

  if (!isHttpUrl(coverUrl)) {
    return normalizeStoragePath(coverUrl);
  }

  try {
    const parsed = new URL(coverUrl);
    const marker = `/storage/v1/object/public/${LOOKBOOK_COVERS_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) {
      return "";
    }

    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return "";
  }
}

export function resolveCoverUrl(coverUrl = "") {
  if (!coverUrl) {
    return "";
  }

  if (isHttpUrl(coverUrl)) {
    return coverUrl;
  }

  const { data } = supabase.storage.from(LOOKBOOK_COVERS_BUCKET).getPublicUrl(normalizeStoragePath(coverUrl));
  return data?.publicUrl || "";
}

export async function getLookbooksStats() {
  const [{ data: lookbooksData, error: lookbooksError }, { count: downloadsCount, error: downloadsError }] =
    await Promise.all([
      supabase.from("lookbooks").select("id,is_active,requires_login"),
      supabase.from("lookbook_downloads").select("*", { count: "exact", head: true }),
    ]);

  if (lookbooksError) {
    throw lookbooksError;
  }

  if (downloadsError) {
    throw downloadsError;
  }

  const items = Array.isArray(lookbooksData) ? lookbooksData : [];
  const total = items.length;
  const active = items.filter((item) => item.is_active).length;
  const inactive = total - active;
  const protectedItems = items.filter((item) => item.requires_login).length;

  return {
    total,
    active,
    inactive,
    protected: protectedItems,
    downloads: downloadsCount || 0,
  };
}

export async function getLookbooksPage({
  page = 1,
  pageSize = 10,
  search = "",
  category = "all",
  status = "all",
  access = "all",
  order = "manual_asc",
}) {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = supabase.from("lookbooks").select("*", { count: "exact" });
  const normalizedSearch = String(search || "").trim();

  if (normalizedSearch) {
    const term = normalizedSearch.replace(/,/g, " ");
    query = query.or(`title.ilike.%${term}%,aircraft_name.ilike.%${term}%`);
  }

  if (category !== "all") {
    query = query.eq("category", category);
  }

  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  if (access === "protected") {
    query = query.eq("requires_login", true);
  } else if (access === "public") {
    query = query.eq("requires_login", false);
  }

  query = applyLookbookOrder(query, order).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const ids = rows.map((item) => item.id).filter(Boolean);
  let downloadsMap = {};

  if (ids.length) {
    const { data: downloadsData, error: downloadsError } = await supabase
      .from("lookbook_downloads")
      .select("lookbook_id")
      .in("lookbook_id", ids);

    if (downloadsError) {
      throw downloadsError;
    }

    downloadsMap = getDownloadsCountMap(downloadsData || []);
  }

  return {
    rows: rows.map((item) => ({
      ...item,
      cover_preview_url: resolveCoverUrl(item.cover_url),
      downloads_count: downloadsMap[item.id] || 0,
    })),
    total: count || 0,
  };
}

export async function getLookbookDownloadsPage({ lookbookId, page = 1, pageSize = 10 }) {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("lookbook_downloads")
    .select("id,downloaded_at,email,user_id,ip_address,user_agent", { count: "exact" })
    .eq("lookbook_id", lookbookId)
    .order("downloaded_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    rows: Array.isArray(data) ? data : [],
    total: count || 0,
  };
}

export async function createLookbook(payload) {
  const { data, error } = await supabase.from("lookbooks").insert(payload).select("*").single();
  if (error) {
    throw error;
  }

  return data;
}

export async function updateLookbook(id, payload) {
  const { data, error } = await supabase.from("lookbooks").update(payload).eq("id", id).select("*").single();
  if (error) {
    throw error;
  }

  return data;
}

export async function updateLookbookStatus(id, isActive) {
  const { error } = await supabase.from("lookbooks").update({ is_active: isActive }).eq("id", id);
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

export async function uploadCoverFile({ file, slug, onProgress }) {
  const path = buildStoragePath({ slug, fileName: file?.name || "cover" });
  onProgress?.(15);

  const { data, error } = await supabase.storage
    .from(LOOKBOOK_COVERS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });

  if (error) {
    throw error;
  }

  onProgress?.(100);

  const { data: publicData } = supabase.storage.from(LOOKBOOK_COVERS_BUCKET).getPublicUrl(data?.path || path);

  return {
    path: data?.path || path,
    publicUrl: publicData?.publicUrl || "",
  };
}

export async function uploadPdfFile({ file, slug, onProgress }) {
  const path = buildStoragePath({ slug, fileName: file?.name || "documento.pdf" });
  onProgress?.(15);

  const { data, error } = await supabase.storage
    .from(LOOKBOOK_PDFS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: "application/pdf" });

  if (error) {
    throw error;
  }

  onProgress?.(100);

  return data?.path || path;
}

export async function removeCoverFile(coverUrl = "") {
  const storagePath = extractCoverStoragePath(coverUrl);
  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage.from(LOOKBOOK_COVERS_BUCKET).remove([storagePath]);
  if (error) {
    throw error;
  }
}

export async function removePdfFile(pdfPath = "") {
  const storagePath = normalizeStoragePath(pdfPath);
  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage.from(LOOKBOOK_PDFS_BUCKET).remove([storagePath]);
  if (error) {
    throw error;
  }
}

export async function removeLookbookAssets({ coverUrl = "", pdfPath = "" }) {
  await Promise.allSettled([removeCoverFile(coverUrl), removePdfFile(pdfPath)]);
}

export async function createPdfSignedUrl(pdfPath, expiresIn = 300) {
  const path = normalizeStoragePath(pdfPath);
  if (!path) {
    return "";
  }

  const { data, error } = await supabase.storage.from(LOOKBOOK_PDFS_BUCKET).createSignedUrl(path, expiresIn);
  if (error) {
    throw error;
  }

  return data?.signedUrl || "";
}
