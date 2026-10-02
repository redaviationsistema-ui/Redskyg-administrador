import { supabase } from "@/supabase";
import { buildAircraftSaleSlug, slugifyAircraftSale, validateAircraftSalesPdf } from "../utils/aircraftSalesFileValidation";

export { buildAircraftSaleSlug } from "../utils/aircraftSalesFileValidation";

const BUCKET = "aircraft-sales";
const PDF_BUCKET = "aircraft-pdfs";
const AIRCRAFT = "aircraft_sales";
const IMAGES = "aircraft_sales_images";
const INQUIRIES = "aircraft_sales_inquiries";
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export const AIRCRAFT_STATUSES = Object.freeze(["ready_to_operate", "out_of_service"]);
export const INQUIRY_STATUSES = Object.freeze(["new", "in_follow_up", "answered", "closed"]);

export const aircraftStatusLabels = Object.freeze({
  ready_to_operate: "Listo para operar",
  out_of_service: "Fuera de servicio",
});

export const inquiryStatusLabels = Object.freeze({
  new: "Nueva",
  in_follow_up: "En seguimiento",
  answered: "Respondida",
  closed: "Cerrada",
});

function isMissingTableError(error) {
  return error?.code === "42P01" || error?.status === 404 || /aircraft_sales_inquiries|schema cache|not found/i.test(error?.message || "");
}

function normalizeStoragePath(path = "") {
  return String(path || "").replace(/^\/+/, "");
}

function safePdfFileName(aircraft, file) {
  const original = String(file?.name || "").replace(/\.pdf$/i, "");
  const base = slugifyAircraftSale([aircraft.registration, aircraft.name || aircraft.model || original || Date.now()].filter(Boolean).join("-"));
  return `${base || Date.now()}.pdf`;
}

export function getAircraftSaleImageUrl(path) {
  if (!path) return "";
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function normalizeAircraft(aircraft) {
  const related = aircraft.aircraft_sales_images || [];
  const activeImages = related.filter?.((image) => image.is_active) || [];
  const coverImage = activeImages.find((image) => image.is_cover) || null;

  return {
    ...aircraft,
    image_count: Number(aircraft.image_count ?? related[0]?.count ?? related.length ?? 0),
    cover_image: coverImage ? normalizeImage(coverImage) : null,
    cover_url: coverImage ? getAircraftSaleImageUrl(coverImage.storage_path) : "",
  };
}

function normalizeImage(image) {
  return {
    ...image,
    image_url: getAircraftSaleImageUrl(image.storage_path),
    display_order: Number(image.display_order || 0),
    is_active: Boolean(image.is_active),
    is_cover: Boolean(image.is_cover),
  };
}

export async function listAircraft(filters = {}) {
  let query = supabase
    .from(AIRCRAFT)
    .select("*, aircraft_sales_images(count)")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.search) {
    const term = String(filters.search).trim();
    query = query.or(`name.ilike.%${term}%,model.ilike.%${term}%,registration.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeAircraft);
}

export async function listPublicAircraft() {
  const { data, error } = await supabase
    .from(AIRCRAFT)
    .select("*, aircraft_sales_images(id, aircraft_sale_id, storage_path, is_cover, is_active, display_order)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;

  return (data || []).map((aircraft) => {
    const publicImages = (aircraft.aircraft_sales_images || [])
      .filter((image) => image.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(normalizeImage);
    const coverImage = publicImages.find((image) => image.is_cover) || null;
    return {
      ...normalizeAircraft({ ...aircraft, aircraft_sales_images: publicImages, image_count: publicImages.length }),
      images: publicImages,
      cover_image: coverImage,
      cover_url: coverImage?.image_url || "",
    };
  });
}

export async function getAircraftBySlug(slug) {
  const { data, error } = await supabase.from(AIRCRAFT).select("*").eq("slug", slug).single();
  if (error) throw error;
  return normalizeAircraft(data);
}

async function nextDisplayOrder() {
  const { data, error } = await supabase
    .from(AIRCRAFT)
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.display_order || 0) + 1;
}

export async function createAircraft(values) {
  const slug = buildAircraftSaleSlug(values.name, values.registration);
  if (!slug) throw new Error("Escribe un nombre o matricula validos.");

  const payload = {
    ...values,
    slug,
    display_order: await nextDisplayOrder(),
    is_active: Boolean(values.is_active),
  };

  const { data, error } = await supabase.from(AIRCRAFT).insert(payload).select().single();
  if (error?.code === "23505") throw new Error("Ya existe una aeronave con ese nombre o matricula.");
  if (error) throw error;
  return normalizeAircraft(data);
}

export async function updateAircraft(id, values) {
  const payload = { ...values };
  if (values.name || values.registration) {
    payload.slug = buildAircraftSaleSlug(values.name, values.registration);
  }
  const { data, error } = await supabase.from(AIRCRAFT).update(payload).eq("id", id).select().single();
  if (error?.code === "23505") throw new Error("Ya existe una aeronave con ese nombre o matricula.");
  if (error) throw error;
  return normalizeAircraft(data);
}

export async function setAircraftActive(id, isActive) {
  const { error } = await supabase.from(AIRCRAFT).update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function setAircraftStatus(id, status) {
  const { error } = await supabase.from(AIRCRAFT).update({ status }).eq("id", id);
  if (error) throw error;
}

async function updateOrders(table, items) {
  const results = await Promise.all(items.map(({ id, display_order }) => supabase.from(table).update({ display_order }).eq("id", id)));
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;
}

export const reorderAircraft = (items) => updateOrders(AIRCRAFT, items);
export const reorderAircraftImages = (items) => updateOrders(IMAGES, items);

export async function listAircraftImages(aircraftId) {
  const { data, error } = await supabase
    .from(IMAGES)
    .select("*")
    .eq("aircraft_sale_id", aircraftId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeImage);
}

async function uploadAircraftImage(aircraft, file, displayOrder) {
  const extension = EXTENSIONS[file.type];
  const path = `aircraft/${aircraft.slug}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from(IMAGES)
    .insert({ aircraft_sale_id: aircraft.id, storage_path: path, display_order: displayOrder, is_cover: false, is_active: true })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return normalizeImage(data);
}

export async function uploadAircraftImages(aircraft, files, onProgress) {
  const current = await listAircraftImages(aircraft.id);
  const start = Math.max(0, ...current.map((item) => item.display_order)) + 1;
  const uploaded = [];
  for (let index = 0; index < files.length; index += 1) {
    uploaded.push(await uploadAircraftImage(aircraft, files[index], start + index));
    onProgress?.(Math.round(((index + 1) / files.length) * 100));
  }
  return uploaded;
}

export async function setAircraftCover(aircraftId, imageId) {
  const [{ data: selected, error: selectedError }, { data: previous, error: previousError }] = await Promise.all([
    supabase.from(IMAGES).select("id, storage_path").eq("id", imageId).eq("aircraft_sale_id", aircraftId).single(),
    supabase.from(IMAGES).select("id").eq("aircraft_sale_id", aircraftId).eq("is_cover", true).maybeSingle(),
  ]);
  if (selectedError) throw selectedError;
  if (previousError) throw previousError;

  const { error: clearError } = await supabase.from(IMAGES).update({ is_cover: false }).eq("aircraft_sale_id", aircraftId).eq("is_cover", true);
  if (clearError) throw clearError;

  const { error: coverError } = await supabase.from(IMAGES).update({ is_cover: true, is_active: true }).eq("id", imageId).eq("aircraft_sale_id", aircraftId);
  if (coverError) {
    if (previous?.id) await supabase.from(IMAGES).update({ is_cover: true }).eq("id", previous.id);
    throw coverError;
  }

  return selected;
}

export async function setAircraftImageActive(id, isActive) {
  const { error } = await supabase.from(IMAGES).update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteAircraftImage(image) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from(IMAGES).delete().eq("id", image.id);
  if (error) throw error;
}

export async function deleteAircraft(aircraft) {
  const images = await listAircraftImages(aircraft.id);
  const paths = images.map((image) => image.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) throw storageError;
  }
  if (aircraft.pdf_path) {
    await supabase.storage.from(PDF_BUCKET).remove([normalizeStoragePath(aircraft.pdf_path)]);
  }
  const { error } = await supabase.from(AIRCRAFT).delete().eq("id", aircraft.id);
  if (error) throw error;
}

export async function uploadAircraftPdf(aircraft, file) {
  const validationError = validateAircraftSalesPdf(file);
  if (validationError) throw new Error(validationError);

  const path = `${aircraft.id}/${Date.now()}-${safePdfFileName(aircraft, file)}`;
  const { data, error: uploadError } = await supabase.storage.from(PDF_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const storedPath = data?.path || path;
  const previousPath = normalizeStoragePath(aircraft.pdf_path);
  const { data: updated, error: updateError } = await supabase
    .from(AIRCRAFT)
    .update({ pdf_path: storedPath })
    .eq("id", aircraft.id)
    .select()
    .single();

  if (updateError) {
    await supabase.storage.from(PDF_BUCKET).remove([storedPath]).catch(() => {});
    throw updateError;
  }

  if (previousPath && previousPath !== storedPath) {
    await supabase.storage.from(PDF_BUCKET).remove([previousPath]).catch(() => {});
  }

  return normalizeAircraft(updated);
}

export async function deleteAircraftPdf(aircraft) {
  const pdfPath = normalizeStoragePath(aircraft.pdf_path);
  if (pdfPath) {
    const { error: storageError } = await supabase.storage.from(PDF_BUCKET).remove([pdfPath]);
    if (storageError) throw storageError;
  }

  const { data, error } = await supabase.from(AIRCRAFT).update({ pdf_path: null }).eq("id", aircraft.id).select().single();
  if (error) throw error;
  return normalizeAircraft(data);
}

export async function createAircraftPdfSignedUrl(pdfPath, expiresIn = 600) {
  const path = normalizeStoragePath(pdfPath);
  if (!path) return "";
  const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || "";
}

export async function listAircraftInquiries(status = "") {
  let query = supabase
    .from(INQUIRIES)
    .select("*, aircraft_sales(name, registration, price, currency, slug, status, pdf_path)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error && isMissingTableError(error)) {
    const setupError = new Error("Falta crear o recargar la tabla aircraft_sales_inquiries en Supabase.");
    setupError.code = "AIRCRAFT_SALES_INQUIRIES_MISSING";
    setupError.cause = error;
    throw setupError;
  }
  if (error) throw error;
  return data || [];
}

export async function getAircraftInquiry(id) {
  const { data, error } = await supabase
    .from(INQUIRIES)
    .select("*, aircraft_sales(name, registration, price, currency, slug, status, pdf_path)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateInquiryStatus(id, status) {
  const { data, error } = await supabase.from(INQUIRIES).update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInquiry(id) {
  const { error } = await supabase.from(INQUIRIES).delete().eq("id", id);
  if (error) throw error;
}
