import { supabase } from "@/supabase";
import { slugifyVillaName } from "../utils/experienceFileValidation";
export { slugifyVillaName } from "../utils/experienceFileValidation";

const BUCKET = "experiences";
const VILLAS = "experience_villas";
const IMAGES = "experience_villa_images";
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export function getExperienceImageUrl(path) {
  if (!path) return "";
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function normalizeVilla(villa) {
  const related = villa.experience_villa_images || [];
  return {
    ...villa,
    image_count: Number(villa.image_count ?? related[0]?.count ?? related.length ?? 0),
    cover_url: getExperienceImageUrl(villa.cover_path),
  };
}

function normalizeImage(image) {
  return { ...image, image_url: getExperienceImageUrl(image.image_path), sort_order: Number(image.sort_order || 0), is_active: Boolean(image.is_active) };
}

export async function listVillas() {
  const { data, error } = await supabase.from(VILLAS)
    .select("*, experience_villa_images(count)").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeVilla);
}

export async function listPublicVillas() {
  const { data, error } = await supabase.from(VILLAS)
    .select("*, experience_villa_images(id, image_path, sort_order, is_cover, is_active)")
    .eq("is_active", true).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map((villa) => {
    const publicImages = (villa.experience_villa_images || [])
      .filter((image) => image.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(normalizeImage);
    return normalizeVilla({ ...villa, experience_villa_images: publicImages, image_count: publicImages.length });
  });
}

export async function getVillaBySlug(slug) {
  const { data, error } = await supabase.from(VILLAS).select("*").eq("slug", slug).single();
  if (error) throw error;
  return normalizeVilla(data);
}

export async function createVilla(name, destination) {
  const slug = slugifyVillaName(name);
  if (!slug) throw new Error("Escribe un nombre válido para la villa.");
  const { data: last, error: orderError } = await supabase.from(VILLAS).select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (orderError) throw orderError;
  const { data, error } = await supabase.from(VILLAS).insert({ name: name.trim(), destination: destination.trim(), slug, sort_order: Number(last?.sort_order || 0) + 1 }).select().single();
  if (error?.code === "23505") throw new Error("Ya existe una villa con ese nombre o slug.");
  if (error) throw error;
  return normalizeVilla(data);
}

export async function setVillaActive(id, isActive) {
  const { error } = await supabase.from(VILLAS).update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

async function updateOrders(table, items) {
  const results = await Promise.all(items.map(({ id, sort_order }) => supabase.from(table).update({ sort_order }).eq("id", id)));
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;
}

export const reorderVillas = (items) => updateOrders(VILLAS, items);
export const reorderVillaImages = (items) => updateOrders(IMAGES, items);

export async function listVillaImages(villaId) {
  const { data, error } = await supabase.from(IMAGES).select("*").eq("villa_id", villaId).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeImage);
}

async function uploadVillaImage(villa, file, sortOrder) {
  const extension = EXTENSIONS[file.type];
  const path = `villas/${villa.slug}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "31536000", contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.from(IMAGES).insert({ villa_id: villa.id, image_path: path, sort_order: sortOrder, is_cover: false, is_active: true }).select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return normalizeImage(data);
}

export async function uploadVillaImages(villa, files, onProgress) {
  const current = await listVillaImages(villa.id);
  const start = Math.max(0, ...current.map((item) => item.sort_order)) + 1;
  const uploaded = [];
  for (let index = 0; index < files.length; index += 1) {
    uploaded.push(await uploadVillaImage(villa, files[index], start + index));
    onProgress?.(Math.round(((index + 1) / files.length) * 100));
  }
  return uploaded;
}

export async function setVillaCover(villaId, imageId) {
  const [{ data: selected, error: selectedError }, { data: previous, error: previousError }] = await Promise.all([
    supabase.from(IMAGES).select("id, image_path").eq("id", imageId).eq("villa_id", villaId).single(),
    supabase.from(IMAGES).select("id, image_path").eq("villa_id", villaId).eq("is_cover", true).maybeSingle(),
  ]);
  if (selectedError) throw selectedError;
  if (previousError) throw previousError;

  const { error: clearError } = await supabase.from(IMAGES)
    .update({ is_cover: false }).eq("villa_id", villaId).eq("is_cover", true);
  if (clearError) throw clearError;

  const { error: coverError } = await supabase.from(IMAGES)
    .update({ is_cover: true, is_active: true }).eq("id", imageId).eq("villa_id", villaId);
  if (coverError) {
    if (previous?.id) await supabase.from(IMAGES).update({ is_cover: true }).eq("id", previous.id);
    throw coverError;
  }

  const { error: villaError } = await supabase.from(VILLAS)
    .update({ cover_path: selected.image_path }).eq("id", villaId);
  if (villaError) {
    await supabase.from(IMAGES).update({ is_cover: false }).eq("id", imageId);
    if (previous?.id) await supabase.from(IMAGES).update({ is_cover: true }).eq("id", previous.id);
    throw villaError;
  }
}

export async function setVillaImageActive(id, isActive) {
  const { error } = await supabase.from(IMAGES).update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteVillaImage(image) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.image_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from(IMAGES).delete().eq("id", image.id);
  if (error) throw error;
  if (image.is_cover) {
    const { error: coverError } = await supabase.from(VILLAS).update({ cover_path: null }).eq("id", image.villa_id);
    if (coverError) throw coverError;
  }
}

export async function deleteVilla(villa) {
  const images = await listVillaImages(villa.id);
  const paths = images.map((image) => image.image_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from(VILLAS).delete().eq("id", villa.id);
  if (error) throw error;
}
