<template>
  <div class="page">
    <div class="form-card">
      <div class="header-row">
        <div>
          <p class="eyebrow">Fleet management</p>
          <h2>{{ isEditMode ? "Editar Aeronave" : "Crear Aeronave" }}</h2>
          <p class="subcopy">
            Guarda la ficha tecnica y la galeria en un solo flujo, con validaciones y vista previa.
          </p>
        </div>

        <div class="status-chip" :class="{ active: form.is_active }">
          {{ form.is_active ? "Activa" : "Inactiva" }}
        </div>
      </div>

      <div v-if="validationSummary.length" class="error-banner">
        <strong>Revisa estos campos:</strong>
        <ul>
          <li v-for="item in validationSummary" :key="item">{{ item }}</li>
        </ul>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label for="name">Nombre</label>
          <input
            id="name"
            v-model.trim="form.name"
            :class="{ invalid: errors.name }"
            placeholder="Bell 505"
          />
          <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
        </div>

        <div class="form-group">
          <label for="year">Año</label>
          <input
            id="year"
            v-model.number="form.year"
            type="number"
            min="1900"
            max="2100"
            :class="{ invalid: errors.year }"
            placeholder="2014"
          />
          <small v-if="errors.year" class="field-error">{{ errors.year }}</small>
        </div>

        <div class="form-group">
          <label for="aircraft-type">Tipo de aeronave</label>
          <input
            id="aircraft-type"
            v-model.trim="form.aircraft_type"
            :class="{ invalid: errors.aircraft_type }"
            placeholder="Helicoptero"
          />
          <small v-if="errors.aircraft_type" class="field-error">{{ errors.aircraft_type }}</small>
        </div>

        <div class="form-group">
          <label for="manufacturer">Fabricante</label>
          <input
            id="manufacturer"
            v-model.trim="form.manufacturer"
            placeholder="Bell"
          />
        </div>

        <div class="form-group">
          <label for="engines">Motores</label>
          <input
            id="engines"
            v-model.trim="form.engines"
            placeholder="Turboeje"
          />
        </div>

        <div class="form-group">
          <label for="capacity">Capacidad pasajeros</label>
          <input
            id="capacity"
            v-model.number="form.capacity_passengers"
            type="number"
            min="0"
            :class="{ invalid: errors.capacity_passengers }"
            placeholder="4"
          />
          <small v-if="errors.capacity_passengers" class="field-error">
            {{ errors.capacity_passengers }}
          </small>
        </div>

        <div class="form-group">
          <label for="crew">Tripulacion</label>
          <input
            id="crew"
            v-model.number="form.crew"
            type="number"
            min="0"
            :class="{ invalid: errors.crew }"
            placeholder="1"
          />
          <small v-if="errors.crew" class="field-error">{{ errors.crew }}</small>
        </div>

        <div class="form-group">
          <label for="iata">IATA</label>
          <input
            id="iata"
            v-model.trim="form.iata"
            maxlength="5"
            :class="{ invalid: errors.iata }"
            placeholder="TLC"
          />
          <small v-if="errors.iata" class="field-error">{{ errors.iata }}</small>
        </div>

        <div class="form-group">
          <label for="rental-price">Precio por hora (USD)</label>
          <input
            id="rental-price"
            v-model.number="form.rental_price_usd"
            type="number"
            min="0"
            step="0.01"
            :class="{ invalid: errors.rental_price_usd }"
            placeholder="1200"
          />
          <small v-if="errors.rental_price_usd" class="field-error">
            {{ errors.rental_price_usd }}
          </small>
        </div>

        <div class="form-group">
          <label for="cruise-speed">Velocidad crucero (knots)</label>
          <input
            id="cruise-speed"
            v-model.number="form.cruise_speed_knots"
            type="number"
            min="0"
            step="1"
            placeholder="125"
          />
        </div>

        <div class="form-group">
          <label for="national-expenses">Gastos nacionales (USD)</label>
          <input
            id="national-expenses"
            v-model.number="form.national_expenses_usd"
            type="number"
            min="0"
            step="0.01"
            placeholder="250"
          />
        </div>

        <div class="form-group">
          <label for="range">Rango (NM)</label>
          <input
            id="range"
            v-model.number="form.range_nm"
            type="number"
            min="0"
            step="1"
            placeholder="306"
          />
        </div>

        <div class="form-group full-width">
          <label for="estado">Estado</label>
          <input
            id="estado"
            v-model.trim="form.estado"
            placeholder="ACTIVO"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="ideal-use">Uso ideal</label>
        <input
          id="ideal-use"
          v-model.trim="form.ideal_use"
          placeholder="Traslados ejecutivos y vuelos cortos"
        />
      </div>

      <div class="form-group">
        <label for="descripcion">Descripcion</label>
        <textarea
          id="descripcion"
          v-model.trim="form.descripcion"
          rows="4"
          placeholder="Describe la aeronave, autonomia, configuracion y uso recomendado."
        ></textarea>
      </div>

      <label class="checkbox-row">
        <input v-model="form.is_active" type="checkbox" />
        <span>Mostrar como disponible en el catalogo</span>
      </label>

      <div class="actions-row">
        <button
          class="btn-secondary"
          type="button"
          :disabled="isBusy"
          @click="saveAircraftOnly"
        >
          {{ savingAircraft ? "Guardando..." : "Guardar datos" }}
        </button>

        <button
          class="btn-primary"
          type="button"
          :disabled="isBusy"
          @click="saveAll"
        >
          {{ savingAll ? "Guardando todo..." : "Guardar todo" }}
        </button>
      </div>

      <hr />

      <section class="gallery-section">
        <div class="gallery-header">
          <div>
            <h3>Galeria de Imagenes</h3>
            <p class="gallery-copy">
              Puedes seleccionar imagenes antes de guardar. El sistema sube solo las nuevas y conserva
              las existentes.
            </p>
          </div>
          <div class="gallery-stats">
            <span>{{ imageItems.length }} imagenes</span>
            <span>{{ pendingImageCount }} pendientes</span>
          </div>
        </div>

        <div class="file-drop">
          <input
            ref="fileInputRef"
            class="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            @change="handleFileSelection"
          />
          <div class="file-drop-copy">
            <strong>Arrastra o elige archivos</strong>
            <small>JPG, PNG, WEBP hasta 2MB por imagen</small>
          </div>
        </div>

        <div v-if="imageErrors.length" class="image-errors">
          <p v-for="message in imageErrors" :key="message">{{ message }}</p>
        </div>

        <div v-if="imageItems.length" class="image-preview">
          <article
            v-for="item in imageItems"
            :key="item.id"
            class="image-card"
            :class="{ featured: item.url === primaryImageUrl }"
          >
            <img :src="item.url" :alt="item.name || form.name || 'Aircraft image'" />

            <div class="image-card-body">
              <div class="image-meta">
                <strong>{{ item.name || "Imagen" }}</strong>
                <small>
                  {{
                    item.kind === "existing"
                      ? "Guardada"
                      : item.status === "uploaded"
                        ? "Subida"
                        : "Pendiente"
                  }}
                </small>
              </div>

              <div class="image-card-actions">
                <button
                  class="tiny-btn"
                  type="button"
                  :disabled="isBusy || item.url === primaryImageUrl"
                  @click="setPrimaryImage(item.id)"
                >
                  {{ item.url === primaryImageUrl ? "Principal" : "Usar portada" }}
                </button>
                <button
                  class="tiny-danger"
                  type="button"
                  :disabled="isBusy"
                  @click="removeImage(item.id)"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </article>
        </div>

        <p v-else class="empty-gallery">
          Aun no hay imagenes seleccionadas para esta aeronave.
        </p>

        <div class="actions-row compact">
          <button
            class="btn-secondary"
            type="button"
            :disabled="isBusy || !imageItems.length"
            @click="saveImagesOnly"
          >
            {{ uploadingImages ? "Guardando imagenes..." : "Guardar imagenes" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { supabase } from "@/supabase";
import { useRoute, useRouter } from "vue-router";
import { useFeedback } from "@/composables/useFeedback";

const route = useRoute();
const router = useRouter();
const feedback = useFeedback();

const fileInputRef = ref(null);
const loading = ref(false);
const savingAircraft = ref(false);
const savingAll = ref(false);
const uploadingImages = ref(false);
const errors = ref({});
const imageErrors = ref([]);
const imageItems = ref([]);

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const createEmptyForm = () => ({
  id: null,
  year: null,
  name: "",
  aircraft_type: "",
  manufacturer: "",
  engines: "",
  capacity_passengers: null,
  crew: null,
  iata: "",
  rental_price_usd: null,
  ideal_use: "",
  cruise_speed_knots: null,
  national_expenses_usd: null,
  range_nm: null,
  estado: "",
  descripcion: "",
  imagen_url: "",
  exterior_images: [],
  interior_images: [],
  storage_folder: "",
  is_active: true,
});

const form = ref(createEmptyForm());

const isEditMode = computed(() => Boolean(route.params.id));
const isBusy = computed(
  () => loading.value || savingAircraft.value || savingAll.value || uploadingImages.value,
);
const pendingImageCount = computed(
  () => imageItems.value.filter((item) => item.kind === "new" && item.status !== "uploaded").length,
);
const validationSummary = computed(() => Object.values(errors.value).filter(Boolean));
const primaryImageUrl = computed(
  () => form.value.imagen_url || imageItems.value[0]?.url || "",
);

function normalizeImageList(images) {
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => {
      if (typeof image === "string") return image;
      if (image && typeof image === "object") {
        return image.url || image.imagen_url || image.publicUrl || null;
      }
      return null;
    })
    .filter(Boolean);
}

function makeImageItem({
  id,
  url,
  name,
  kind,
  file = null,
  status = "pending",
  path = null,
}) {
  return {
    id,
    url,
    name,
    kind,
    file,
    status,
    path,
  };
}

function generateImageId(prefix = "image") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidPositiveNumber(value) {
  return value == null || value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0);
}

function normalizeNullableNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildAircraftPayload() {
  return {
    year: normalizeNullableNumber(form.value.year),
    name: String(form.value.name || "").trim(),
    aircraft_type: String(form.value.aircraft_type || "").trim(),
    manufacturer: String(form.value.manufacturer || "").trim() || null,
    engines: String(form.value.engines || "").trim() || null,
    capacity_passengers: normalizeNullableNumber(form.value.capacity_passengers),
    crew: normalizeNullableNumber(form.value.crew),
    iata: String(form.value.iata || "").trim().toUpperCase() || null,
    rental_price_usd: normalizeNullableNumber(form.value.rental_price_usd),
    ideal_use: String(form.value.ideal_use || "").trim() || null,
    cruise_speed_knots: normalizeNullableNumber(form.value.cruise_speed_knots),
    national_expenses_usd: normalizeNullableNumber(form.value.national_expenses_usd),
    range_nm: normalizeNullableNumber(form.value.range_nm),
    estado: String(form.value.estado || "").trim().toUpperCase() || null,
    descripcion: String(form.value.descripcion || "").trim() || null,
    imagen_url: form.value.imagen_url || null,
    exterior_images: imageItems.value.map((item) => item.url),
    interior_images: normalizeImageList(form.value.interior_images),
    storage_folder: form.value.storage_folder || form.value.id || null,
    is_active: Boolean(form.value.is_active),
  };
}

function validateForm() {
  const nextErrors = {};

  if (!String(form.value.name || "").trim()) {
    nextErrors.name = "El nombre es obligatorio.";
  }

  if (!String(form.value.aircraft_type || "").trim()) {
    nextErrors.aircraft_type = "El tipo de aeronave es obligatorio.";
  }

  if (!isValidPositiveNumber(form.value.year)) {
    nextErrors.year = "Ingresa un año valido.";
  }

  if (!isValidPositiveNumber(form.value.capacity_passengers)) {
    nextErrors.capacity_passengers = "La capacidad debe ser un numero positivo.";
  }

  if (!isValidPositiveNumber(form.value.crew)) {
    nextErrors.crew = "La tripulacion debe ser un numero positivo.";
  }

  if (!isValidPositiveNumber(form.value.rental_price_usd)) {
    nextErrors.rental_price_usd = "El precio por hora debe ser un numero valido.";
  }

  const iata = String(form.value.iata || "").trim();
  if (iata && iata.length > 5) {
    nextErrors.iata = "El IATA no debe exceder 5 caracteres.";
  }

  errors.value = nextErrors;
  return Object.keys(nextErrors).length === 0;
}

async function loadAircraft() {
  const id = route.params.id;
  if (!id) return;

  loading.value = true;

  try {
    const { data, error } = await supabase
      .from("aircraft_fleet")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    form.value = {
      ...createEmptyForm(),
      ...data,
    };

    const currentImages = normalizeImageList(data.exterior_images);
    imageItems.value = currentImages.map((url, index) =>
      makeImageItem({
        id: generateImageId(`existing-${index}`),
        url,
        name: `Imagen ${index + 1}`,
        kind: "existing",
        status: "uploaded",
      }),
    );

    form.value.exterior_images = currentImages;
    form.value.interior_images = normalizeImageList(data.interior_images);
    form.value.imagen_url = data.imagen_url || currentImages[0] || "";
    form.value.storage_folder = data.storage_folder || data.id || "";
  } catch (error) {
    console.error("Error cargando aeronave:", error);
    feedback.error("No se pudo cargar", error, "Revisa la conexion con Supabase.");
  } finally {
    loading.value = false;
  }
}

function revokePreviewUrl(item) {
  if (item?.kind === "new" && item?.url?.startsWith("blob:")) {
    URL.revokeObjectURL(item.url);
  }
}

function syncImageState() {
  const urls = imageItems.value.map((item) => item.url);
  form.value.exterior_images = urls;
  form.value.imagen_url = urls.includes(form.value.imagen_url)
    ? form.value.imagen_url
    : urls[0] || "";
}

function setPrimaryImage(itemId) {
  const selected = imageItems.value.find((item) => item.id === itemId);
  if (!selected) return;

  form.value.imagen_url = selected.url;
  imageItems.value = [
    selected,
    ...imageItems.value.filter((item) => item.id !== itemId),
  ];
  syncImageState();
}

function removeImage(itemId) {
  const current = imageItems.value.find((item) => item.id === itemId);
  if (!current) return;

  revokePreviewUrl(current);
  imageItems.value = imageItems.value.filter((item) => item.id !== itemId);
  syncImageState();
}

function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  imageErrors.value = [];

  const nextItems = [];

  files.forEach((file) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      imageErrors.value.push(`${file.name}: solo se permiten JPG, PNG o WEBP.`);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      imageErrors.value.push(`${file.name}: excede el limite de 2MB.`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    nextItems.push(
      makeImageItem({
        id: generateImageId("new"),
        url: previewUrl,
        name: file.name,
        kind: "new",
        file,
      }),
    );
  });

  imageItems.value = [...imageItems.value, ...nextItems];
  syncImageState();

  if (fileInputRef.value) {
    fileInputRef.value.value = "";
  }
}

async function persistAircraftRecord() {
  const payload = buildAircraftPayload();
  const id = form.value.id;

  const response = id
    ? await supabase
        .from("aircraft_fleet")
        .update(payload)
        .eq("id", id)
        .select()
        .single()
    : await supabase
        .from("aircraft_fleet")
        .insert([payload])
        .select()
        .single();

  if (response.error) throw response.error;

  form.value = {
    ...form.value,
    ...response.data,
    storage_folder: response.data.storage_folder || response.data.id || "",
  };

  return response.data;
}

async function uploadPendingImages(aircraftId) {
  const pendingItems = imageItems.value.filter(
    (item) => item.kind === "new" && item.status !== "uploaded" && item.file,
  );

  if (!pendingItems.length) return { uploaded: 0, failed: 0 };

  let uploaded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    const safeName = String(item.file.name || "image")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = `${aircraftId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("aircraft-images")
      .upload(filePath, item.file, { upsert: true });

    if (uploadError) {
      failed += 1;
      item.status = "error";
      imageErrors.value.push(`${item.name}: no se pudo subir.`);
      continue;
    }

    const { data } = supabase.storage
      .from("aircraft-images")
      .getPublicUrl(filePath);

    revokePreviewUrl(item);
    item.url = data.publicUrl;
    item.path = filePath;
    item.status = "uploaded";
    uploaded += 1;
  }

  syncImageState();

  return { uploaded, failed };
}

async function persistImageGallery() {
  if (!form.value.id) {
    throw new Error("La aeronave debe existir antes de guardar la galeria.");
  }

  const imageUrls = imageItems.value.map((item) => item.url);
  const mainImage = form.value.imagen_url || imageUrls[0] || null;

  const { error } = await supabase
    .from("aircraft_fleet")
    .update({
      imagen_url: mainImage,
      exterior_images: imageUrls,
      storage_folder: form.value.storage_folder || form.value.id,
    })
    .eq("id", form.value.id);

  if (error) throw error;

  form.value.imagen_url = mainImage || "";
  form.value.exterior_images = imageUrls;
}

async function saveAircraftOnly() {
  if (!validateForm()) {
    feedback.warning("Formulario incompleto", "Corrige los campos marcados antes de guardar.");
    return;
  }

  savingAircraft.value = true;

  try {
    await persistAircraftRecord();
    feedback.success("Aeronave guardada", "Los datos principales se actualizaron correctamente.");
  } catch (error) {
    console.error("Error guardando aeronave:", error);
    feedback.error("No se pudo guardar la aeronave", error);
  } finally {
    savingAircraft.value = false;
  }
}

async function saveImagesOnly() {
  uploadingImages.value = true;
  imageErrors.value = [];

  try {
    if (!form.value.id) {
      if (!validateForm()) {
        feedback.warning("Primero completa la ficha", "Hace falta guardar la aeronave antes de la galeria.");
        return;
      }

      await persistAircraftRecord();
    }

    const { uploaded, failed } = await uploadPendingImages(form.value.id);
    await persistImageGallery();

    if (failed) {
      feedback.warning(
        "Galeria guardada parcialmente",
        `Se subieron ${uploaded} imagenes y ${failed} fallaron.`,
      );
      return;
    }

    feedback.success("Imagenes guardadas", "La galeria se actualizo correctamente.");
  } catch (error) {
    console.error("Error guardando imagenes:", error);
    feedback.error("No se pudo guardar la galeria", error);
  } finally {
    uploadingImages.value = false;
  }
}

async function saveAll() {
  if (!validateForm()) {
    feedback.warning("Formulario incompleto", "Corrige los campos marcados antes de guardar.");
    return;
  }

  savingAll.value = true;
  imageErrors.value = [];

  try {
    const savedAircraft = await persistAircraftRecord();
    const uploadSummary = await uploadPendingImages(savedAircraft.id);
    await persistImageGallery();

    if (uploadSummary.failed) {
      feedback.warning(
        "Guardado con observaciones",
        `La aeronave se guardo, pero ${uploadSummary.failed} imagen(es) no se pudieron subir.`,
      );
    } else {
      feedback.success("Aeronave actualizada", "Datos e imagenes guardados correctamente.");
    }

    router.push("/aircraft");
  } catch (error) {
    console.error("Error guardando todo:", error);
    feedback.error("No se pudo completar el guardado", error);
  } finally {
    savingAll.value = false;
  }
}

onMounted(loadAircraft);

onBeforeUnmount(() => {
  imageItems.value.forEach(revokePreviewUrl);
});
</script>

<style scoped>
.page {
  padding: 32px;
  display: flex;
  justify-content: center;
  background: linear-gradient(180deg, #edf3fb 0%, #f7f9fc 100%);
  min-height: 100vh;
}

.form-card {
  width: min(1120px, 100%);
  background: #ffffff;
  border: 1px solid #d9e4f1;
  border-radius: 24px;
  padding: 36px;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2b6cb0;
}

h2 {
  margin: 0;
  font-size: 32px;
  line-height: 1.05;
  color: #12243c;
}

.subcopy {
  margin: 10px 0 0;
  color: #52637a;
  max-width: 640px;
}

.status-chip {
  padding: 10px 14px;
  border-radius: 999px;
  background: #eef2f7;
  color: #516177;
  font-weight: 700;
  white-space: nowrap;
}

.status-chip.active {
  background: #e7f7ee;
  color: #1d7a46;
}

.error-banner {
  margin-bottom: 24px;
  border: 1px solid #f1b5b5;
  background: #fff4f4;
  color: #9b1c1c;
  border-radius: 16px;
  padding: 14px 16px;
}

.error-banner strong {
  display: block;
  margin-bottom: 6px;
}

.error-banner ul {
  margin: 0;
  padding-left: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 28px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.full-width {
  grid-column: 1 / -1;
}

label {
  font-size: 14px;
  font-weight: 700;
  color: #20334f;
}

input,
textarea,
select {
  width: 100%;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid #d6dfeb;
  background: #ffffff;
  font-size: 14px;
  color: #132238;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  box-sizing: border-box;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: #2b6cb0;
  box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.14);
}

.invalid {
  border-color: #d94a4a;
  box-shadow: 0 0 0 3px rgba(217, 74, 74, 0.12);
}

.field-error {
  color: #c53030;
  font-size: 12px;
}

textarea {
  min-height: 112px;
  resize: vertical;
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  cursor: pointer;
}

.checkbox-row input {
  width: auto;
  margin: 0;
}

.checkbox-row span {
  color: #20334f;
  font-weight: 600;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.actions-row.compact {
  justify-content: flex-start;
}

button {
  border: none;
  border-radius: 12px;
  padding: 13px 18px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.18s ease, filter 0.18s ease, opacity 0.18s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(0.98);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-primary {
  background: linear-gradient(135deg, #244790 0%, #1d3472 100%);
  color: #ffffff;
}

.btn-secondary {
  background: #e7eef8;
  color: #1f4f93;
}

hr {
  margin: 32px 0;
  border: none;
  border-top: 1px solid #e4ebf4;
}

.gallery-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

h3 {
  margin: 0;
  font-size: 24px;
  color: #12243c;
}

.gallery-copy {
  margin: 8px 0 0;
  color: #5b6b80;
}

.gallery-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.gallery-stats span {
  background: #f0f5fb;
  color: #29527f;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.file-drop {
  position: relative;
  border: 1px dashed #9fb5d1;
  background: linear-gradient(180deg, #f8fbff 0%, #f2f7fd 100%);
  border-radius: 18px;
  padding: 24px;
}

.file-input {
  width: 100%;
}

.file-drop-copy {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #53657d;
}

.image-errors {
  border-radius: 14px;
  background: #fff7e8;
  border: 1px solid #f3d08c;
  color: #8a5a00;
  padding: 12px 14px;
}

.image-errors p {
  margin: 0;
}

.image-errors p + p {
  margin-top: 6px;
}

.image-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 18px;
}

.image-card {
  border: 1px solid #dce6f2;
  border-radius: 18px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.image-card.featured {
  border-color: #2b6cb0;
  box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.12);
}

.image-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
  background: #edf3fb;
}

.image-card-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.image-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-meta strong {
  color: #132238;
  font-size: 14px;
}

.image-meta small {
  color: #5d7088;
}

.image-card-actions {
  display: flex;
  gap: 8px;
}

.tiny-btn,
.tiny-danger {
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 12px;
}

.tiny-btn {
  background: #e7eef8;
  color: #1f4f93;
}

.tiny-danger {
  background: #fde8e8;
  color: #c53030;
}

.empty-gallery {
  margin: 0;
  color: #62758d;
  padding: 20px;
  border-radius: 16px;
  background: #f6f9fc;
  border: 1px solid #e1e9f3;
}

@media (max-width: 960px) {
  .page {
    padding: 20px;
  }

  .form-card {
    padding: 24px;
  }

  .header-row,
  .gallery-header,
  .actions-row {
    flex-direction: column;
    align-items: stretch;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: auto;
  }

  .image-card-actions {
    flex-direction: column;
  }
}
</style>
