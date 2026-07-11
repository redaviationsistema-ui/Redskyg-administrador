<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import { useFeedback } from "@/composables/useFeedback";
import {
  createLookbook,
  createSignedAssetUrl,
  deleteLookbook,
  formatFileSizeInMb,
  isStoragePath,
  listLookbooks,
  removeStoredFiles,
  reorderLookbooks,
  slugifyLookbook,
  updateLookbook,
  updateLookbookStatus,
  uploadLookbookPdf,
} from "@/services/lookbooks.service";

const feedback = useFeedback();

const CATEGORY_OPTIONS = [
  "Helicóptero",
  "Monomotor Pistón",
  "Turbohélice",
  "Light Jet",
  "Mid Jet",
  "Super Mid",
  "Heavy Jet",
  "Regional Jet",
];

const ACCEPTED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_SIZE = 4 * 1024 * 1024;

const loading = ref(false);
const saving = ref(false);
const reordering = ref(false);
const lookbooks = ref([]);
const editorOpen = ref(false);
const editorMode = ref("create");
const coverUploadProgress = ref(0);
const pdfUploadProgress = ref(0);
const currentCoverPreview = ref("");
const pdfFileLabel = ref("");
const coverFileLabel = ref("");
const errors = reactive({});
const form = reactive(createEmptyForm());

function createEmptyForm() {
  return {
    id: null,
    title: "",
    slug: "",
    description: "",
    aircraft_name: "",
    category: CATEGORY_OPTIONS[0],
    cover_url: "",
    pdf_path: "",
    pages: null,
    size_mb: null,
    is_active: true,
    requires_login: true,
    order_index: null,
    coverFile: null,
    pdfFile: null,
    existingCoverPath: "",
    existingPdfPath: "",
  };
}

const sortedLookbooks = computed(() =>
  [...lookbooks.value].sort((a, b) => {
    const firstOrder = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : Number.MAX_SAFE_INTEGER;
    const secondOrder = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : Number.MAX_SAFE_INTEGER;
    return firstOrder - secondOrder;
  }),
);

const pageStats = computed(() => {
  const total = lookbooks.value.length;
  const active = lookbooks.value.filter((item) => item.is_active).length;
  const gated = lookbooks.value.filter((item) => item.requires_login).length;

  return { total, active, gated };
});

function resetForm() {
  Object.assign(form, createEmptyForm());
  currentCoverPreview.value = "";
  pdfFileLabel.value = "";
  coverFileLabel.value = "";
  coverUploadProgress.value = 0;
  pdfUploadProgress.value = 0;
  clearErrors();
}

function clearErrors() {
  Object.keys(errors).forEach((key) => {
    delete errors[key];
  });
}

function fillForm(item) {
  Object.assign(form, createEmptyForm(), {
    id: item.id,
    title: item.title || "",
    slug: item.slug || "",
    description: item.description || "",
    aircraft_name: item.aircraft_name || "",
    category: item.category || CATEGORY_OPTIONS[0],
    cover_url: item.cover_url || "",
    pdf_path: item.pdf_path || "",
    pages: item.pages,
    size_mb: item.size_mb,
    is_active: Boolean(item.is_active),
    requires_login: item.requires_login !== false,
    order_index: item.order_index ?? null,
    existingCoverPath: item.cover_url || "",
    existingPdfPath: item.pdf_path || "",
  });

  currentCoverPreview.value = item.cover_preview_url || "";
  pdfFileLabel.value = item.pdf_path || "";
  coverFileLabel.value = isStoragePath(item.cover_url)
    ? item.cover_url
    : item.cover_url
      ? "Portada embebida en el registro"
      : "";
}

function deriveSlugFromTitle() {
  if (!form.slug && form.title) {
    form.slug = slugifyLookbook(form.title);
  }
}

function replaceFileExtension(fileName = "", extension = "png") {
  const normalizedExtension = String(extension).replace(/^\.+/, "");
  if (!fileName) {
    return `cover.${normalizedExtension}`;
  }

  const sanitized = String(fileName).trim();
  if (!sanitized.includes(".")) {
    return `${sanitized}.${normalizedExtension}`;
  }

  return sanitized.replace(/\.[^.]+$/, `.${normalizedExtension}`);
}

async function loadImageElement(file) {
  return await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No fue posible procesar la imagen seleccionada."));
    };

    image.src = objectUrl;
  });
}

async function convertCoverToPng(file) {
  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No fue posible preparar la portada para subir.");
  }

  context.drawImage(image, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }

        reject(new Error("No fue posible convertir la portada a PNG."));
      },
      "image/png",
      0.98,
    );
  });

  return new File([blob], replaceFileExtension(file.name, "png"), {
    type: "image/png",
    lastModified: Date.now(),
  });
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("No fue posible serializar la portada."));
    };

    reader.onerror = () => {
      reject(new Error("No fue posible serializar la portada."));
    };

    reader.readAsDataURL(file);
  });
}

function isRenderableDataUrl(value = "") {
  if (!String(value).startsWith("data:image/")) {
    return false;
  }

  const [, payload = ""] = String(value).split(",", 2);
  if (!payload) {
    return false;
  }

  try {
    atob(payload.slice(0, 128));
    return payload.length > 32;
  } catch {
    return false;
  }
}

function handlePdfSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    errors.pdfFile = "El archivo debe ser un PDF válido.";
    event.target.value = "";
    form.pdfFile = null;
    return;
  }

  delete errors.pdfFile;
  form.pdfFile = file;
  pdfFileLabel.value = file.name;
  form.size_mb = formatFileSizeInMb(file.size);
}

async function handleCoverSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
    errors.coverFile = "La portada debe ser JPG, PNG o WEBP.";
    event.target.value = "";
    form.coverFile = null;
    return;
  }

  if (file.size > MAX_COVER_SIZE) {
    errors.coverFile = "La portada no puede exceder 4MB.";
    event.target.value = "";
    form.coverFile = null;
    return;
  }

  let normalizedFile = file;

  try {
    if (file.type === "image/jpeg") {
      normalizedFile = await convertCoverToPng(file);
    }
  } catch (error) {
    errors.coverFile = error.message || "No fue posible preparar la portada.";
    event.target.value = "";
    form.coverFile = null;
    return;
  }

  delete errors.coverFile;
  form.coverFile = normalizedFile;
  coverFileLabel.value =
    normalizedFile.type === "image/png" && file.type === "image/jpeg"
      ? `${normalizedFile.name} (convertido automáticamente desde JPEG)`
      : normalizedFile.name;

  if (currentCoverPreview.value?.startsWith("blob:")) {
    URL.revokeObjectURL(currentCoverPreview.value);
  }

  currentCoverPreview.value = URL.createObjectURL(normalizedFile);
}

function openCreateModal() {
  editorMode.value = "create";
  resetForm();
  form.order_index = lookbooks.value.length + 1;
  editorOpen.value = true;
}

function openEditModal(item) {
  editorMode.value = "edit";
  resetForm();
  fillForm(item);
  editorOpen.value = true;
}

function closeEditor() {
  if (currentCoverPreview.value?.startsWith("blob:")) {
    URL.revokeObjectURL(currentCoverPreview.value);
  }

  editorOpen.value = false;
  resetForm();
}

async function hydrateLookbooks(rows) {
  const hydrated = await Promise.all(
    rows.map(async (item) => {
      let coverPreviewUrl = "";

      if (item.cover_url) {
        try {
          coverPreviewUrl = isStoragePath(item.cover_url)
            ? await createSignedAssetUrl(item.cover_url)
            : isRenderableDataUrl(item.cover_url)
              ? item.cover_url
              : "";
        } catch {
          coverPreviewUrl = "";
        }
      }

      return {
        ...item,
        cover_preview_url: coverPreviewUrl,
      };
    }),
  );

  lookbooks.value = hydrated;
}

async function loadLookbooksData() {
  loading.value = true;

  try {
    const rows = await listLookbooks();
    await hydrateLookbooks(rows);
  } catch (error) {
    feedback.error("No fue posible cargar los lookbooks", error);
  } finally {
    loading.value = false;
  }
}

function validateForm() {
  clearErrors();

  if (!form.title) errors.title = "Ingresa un título.";
  if (!form.slug) errors.slug = "Ingresa un slug.";
  if (!form.aircraft_name) errors.aircraft_name = "Ingresa el nombre de la aeronave.";
  if (!form.category) errors.category = "Selecciona una categoría.";
  if (!form.pdf_path && !form.pdfFile) errors.pdfFile = "Debes subir un PDF.";
  if (form.pages !== null && form.pages !== "" && Number(form.pages) < 1) {
    errors.pages = "El número de páginas debe ser mayor a cero.";
  }
  if (form.size_mb !== null && form.size_mb !== "" && Number(form.size_mb) <= 0) {
    errors.size_mb = "El tamaño del archivo debe ser mayor a cero.";
  }

  return Object.keys(errors).length === 0;
}

function buildPayload(uploadedPdfPath, uploadedCoverPath) {
  return {
    title: form.title.trim(),
    slug: slugifyLookbook(form.slug),
    description: form.description?.trim() || null,
    aircraft_name: form.aircraft_name.trim(),
    category: form.category,
    cover_url: uploadedCoverPath || form.existingCoverPath || null,
    pdf_path: uploadedPdfPath || form.existingPdfPath || null,
    pages: form.pages ? Number(form.pages) : null,
    size_mb: form.size_mb ? Number(form.size_mb) : null,
    is_active: Boolean(form.is_active),
    requires_login: Boolean(form.requires_login),
    order_index: form.order_index ? Number(form.order_index) : lookbooks.value.length + 1,
  };
}

async function saveLookbook() {
  deriveSlugFromTitle();

  if (!validateForm()) {
    feedback.warning("Revisa el formulario", "Hay campos obligatorios o inválidos.");
    return;
  }

  saving.value = true;
  pdfUploadProgress.value = 0;
  coverUploadProgress.value = 0;

  const previousPdfPath = form.existingPdfPath;
  const previousCoverPath = form.existingCoverPath;
  let uploadedPdfPath = "";
  let uploadedCoverPath = "";

  try {
    if (form.pdfFile) {
      try {
        uploadedPdfPath = await uploadLookbookPdf({
          file: form.pdfFile,
          aircraftSlug: form.slug || form.title,
          onProgress: (value) => {
            pdfUploadProgress.value = value;
          },
        });
      } catch (error) {
        feedback.error("No fue posible subir el PDF al bucket lookbooks", error?.message || error);
        return;
      }
    }

    if (form.coverFile) {
      try {
        coverUploadProgress.value = 25;
        uploadedCoverPath = await fileToDataUrl(form.coverFile);
        coverUploadProgress.value = 100;
      } catch (error) {
        if (uploadedPdfPath) {
          await removeStoredFiles([uploadedPdfPath]).catch(() => {});
        }

        feedback.error(
          "No fue posible preparar la portada para guardarla en el lookbook",
          error?.message || error,
        );
        return;
      }
    }

    const payload = buildPayload(uploadedPdfPath, uploadedCoverPath);

    try {
      if (editorMode.value === "create") {
        await createLookbook(payload);
        feedback.notify("Lookbook creado");
      } else {
        await updateLookbook(form.id, payload);
        feedback.notify("Lookbook actualizado");
      }
    } catch (error) {
      if (uploadedPdfPath || uploadedCoverPath) {
        await removeStoredFiles([uploadedPdfPath, uploadedCoverPath]).catch(() => {});
      }

      feedback.error("No fue posible insertar el registro del lookbook en la tabla", error);
      return;
    }

    const filesToRemove = [];
    if (uploadedPdfPath && previousPdfPath && previousPdfPath !== uploadedPdfPath) {
      filesToRemove.push(previousPdfPath);
    }
    if (uploadedCoverPath && previousCoverPath && previousCoverPath !== uploadedCoverPath) {
      filesToRemove.push(previousCoverPath);
    }

    if (filesToRemove.length) {
      await removeStoredFiles(filesToRemove);
    }

    await loadLookbooksData();
    closeEditor();
  } catch (error) {
    feedback.error("No fue posible guardar el lookbook", error);
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(item) {
  try {
    await updateLookbookStatus(item.id, !item.is_active);
    feedback.notify(item.is_active ? "Lookbook desactivado" : "Lookbook activado");
    await loadLookbooksData();
  } catch (error) {
    feedback.error("No fue posible actualizar el estado", error);
  }
}

async function confirmDelete(item) {
  const result = await feedback.confirm({
    title: "Eliminar lookbook",
    text: `Se eliminará "${item.title}" y sus archivos asociados.`,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    icon: "warning",
    confirmButtonColor: "#b91c1c",
  });

  if (!result.isConfirmed) {
    return;
  }

  try {
    await deleteLookbook(item.id);
    await removeStoredFiles([item.pdf_path, item.cover_url]);
    feedback.notify("Lookbook eliminado");
    await loadLookbooksData();
  } catch (error) {
    feedback.error("No fue posible eliminar el lookbook", error);
  }
}

async function moveLookbook(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= sortedLookbooks.value.length || reordering.value) {
    return;
  }

  const nextOrder = [...sortedLookbooks.value];
  const temp = nextOrder[index];
  nextOrder[index] = nextOrder[nextIndex];
  nextOrder[nextIndex] = temp;

  reordering.value = true;

  try {
    await reorderLookbooks(nextOrder);
    await loadLookbooksData();
    feedback.notify("Orden actualizado");
  } catch (error) {
    feedback.error("No fue posible reordenar los lookbooks", error);
  } finally {
    reordering.value = false;
  }
}

async function previewPdf(item) {
  try {
    const url = await createSignedAssetUrl(item.pdf_path, 300);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    feedback.error("No fue posible abrir el PDF", error);
  }
}

onMounted(loadLookbooksData);
</script>

<template>
  <div class="lookbooks-admin page-shell">
    <section class="hero-card panel">
      <div class="hero-copy">
        <p class="eyebrow">Content workspace</p>
        <h1>Lookbooks</h1>
        <p>
          Gestiona la biblioteca de eBooks, su orden, archivos privados y estado de publicación desde una sola vista.
        </p>
      </div>

      <div class="hero-actions">
        <BaseButton @click="openCreateModal">Nuevo lookbook</BaseButton>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card card">
        <span>Total</span>
        <strong>{{ pageStats.total }}</strong>
      </article>
      <article class="stat-card card">
        <span>Activos</span>
        <strong>{{ pageStats.active }}</strong>
      </article>
      <article class="stat-card card">
        <span>Con acceso protegido</span>
        <strong>{{ pageStats.gated }}</strong>
      </article>
    </section>

    <section class="panel table-panel">
      <div class="panel-head">
        <div>
          <h2>Biblioteca administrable</h2>
          <p>Sube PDFs al bucket privado, actualiza portadas y controla el orden de publicación.</p>
        </div>

        <BaseButton variant="secondary" :disabled="loading" @click="loadLookbooksData">
          {{ loading ? "Cargando..." : "Actualizar" }}
        </BaseButton>
      </div>

      <div v-if="loading" class="empty-state">
        <strong>Cargando lookbooks...</strong>
      </div>

      <div v-else-if="!sortedLookbooks.length" class="empty-state">
        <strong>No hay lookbooks registrados todavía.</strong>
        <p>Crea el primero para comenzar a poblar la biblioteca de aeronaves.</p>
      </div>

      <div v-else class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Portada</th>
              <th>Documento</th>
              <th>Categoría</th>
              <th>PDF</th>
              <th>Estado</th>
              <th class="actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in sortedLookbooks" :key="item.id">
              <td class="order-cell">
                <strong>#{{ item.order_index || index + 1 }}</strong>
                <div class="order-buttons">
                  <button :disabled="reordering || index === 0" @click="moveLookbook(index, -1)">↑</button>
                  <button
                    :disabled="reordering || index === sortedLookbooks.length - 1"
                    @click="moveLookbook(index, 1)"
                  >
                    ↓
                  </button>
                </div>
              </td>
              <td>
                <div class="cover-thumb">
                  <img v-if="item.cover_preview_url" :src="item.cover_preview_url" :alt="item.title" />
                  <span v-else>Sin portada</span>
                </div>
              </td>
              <td>
                <div class="doc-copy">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.aircraft_name }}</span>
                  <small>{{ item.slug }}</small>
                </div>
              </td>
              <td>{{ item.category || "-" }}</td>
              <td>
                <div class="doc-meta">
                  <strong>{{ item.pdf_path || "-" }}</strong>
                  <small>{{ item.pages || "-" }} páginas · {{ item.size_mb || "-" }} MB</small>
                </div>
              </td>
              <td>
                <div class="status-stack">
                  <span class="status-pill" :class="{ active: item.is_active }">
                    {{ item.is_active ? "Activo" : "Inactivo" }}
                  </span>
                  <small>{{ item.requires_login ? "Requiere login" : "Acceso libre" }}</small>
                </div>
              </td>
              <td class="actions">
                <div class="action-stack">
                  <button class="action-link" @click="openEditModal(item)">Editar</button>
                  <button class="action-link" @click="previewPdf(item)">Ver PDF</button>
                  <button class="action-link" @click="toggleStatus(item)">
                    {{ item.is_active ? "Desactivar" : "Activar" }}
                  </button>
                  <button class="action-link danger" @click="confirmDelete(item)">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="editorOpen" class="modal-overlay" @click.self="closeEditor">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Lookbooks</p>
            <h2>{{ editorMode === "create" ? "Crear lookbook" : "Editar lookbook" }}</h2>
            <p>Guarda metadatos, portada y documento privado en un solo flujo.</p>
          </div>
          <button class="close-btn" type="button" @click="closeEditor">Cerrar</button>
        </div>

        <div class="modal-body">
          <div class="form-grid">
            <label class="field">
              <span>Título</span>
              <input v-model.trim="form.title" :class="{ invalid: errors.title }" @blur="deriveSlugFromTitle" />
              <small v-if="errors.title" class="field-error">{{ errors.title }}</small>
            </label>

            <label class="field">
              <span>Slug</span>
              <input v-model.trim="form.slug" :class="{ invalid: errors.slug }" placeholder="bell-505-vip-guide" />
              <small v-if="errors.slug" class="field-error">{{ errors.slug }}</small>
            </label>

            <label class="field">
              <span>Aeronave</span>
              <input v-model.trim="form.aircraft_name" :class="{ invalid: errors.aircraft_name }" />
              <small v-if="errors.aircraft_name" class="field-error">{{ errors.aircraft_name }}</small>
            </label>

            <label class="field">
              <span>Categoría</span>
              <select v-model="form.category" :class="{ invalid: errors.category }">
                <option v-for="option in CATEGORY_OPTIONS" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
              <small v-if="errors.category" class="field-error">{{ errors.category }}</small>
            </label>

            <label class="field full-width">
              <span>Descripción</span>
              <textarea v-model.trim="form.description" rows="4"></textarea>
            </label>

            <label class="field">
              <span>Páginas</span>
              <input v-model.number="form.pages" type="number" min="1" :class="{ invalid: errors.pages }" />
              <small v-if="errors.pages" class="field-error">{{ errors.pages }}</small>
            </label>

            <label class="field">
              <span>Tamaño MB</span>
              <input v-model.number="form.size_mb" type="number" min="0" step="0.01" :class="{ invalid: errors.size_mb }" />
              <small v-if="errors.size_mb" class="field-error">{{ errors.size_mb }}</small>
            </label>

            <label class="field">
              <span>Orden</span>
              <input v-model.number="form.order_index" type="number" min="1" />
            </label>

            <div class="field toggle-field">
              <span>Estado</span>
              <label class="checkbox-line">
                <input v-model="form.is_active" type="checkbox" />
                <span>Activo</span>
              </label>
              <label class="checkbox-line">
                <input v-model="form.requires_login" type="checkbox" />
                <span>Requiere login</span>
              </label>
            </div>

            <label class="field full-width">
              <span>PDF del lookbook</span>
              <input type="file" accept="application/pdf" @change="handlePdfSelection" />
              <small class="hint">Solo se aceptan archivos PDF. Se guardará `pdf_path`, no una URL pública.</small>
              <small v-if="pdfFileLabel" class="file-label">{{ pdfFileLabel }}</small>
              <small v-if="errors.pdfFile" class="field-error">{{ errors.pdfFile }}</small>
              <div v-if="saving && (form.pdfFile || pdfUploadProgress)" class="progress-block">
                <div class="progress-bar"><span :style="{ width: `${pdfUploadProgress}%` }"></span></div>
                <small>{{ pdfUploadProgress }}% PDF</small>
              </div>
            </label>

            <div class="field full-width">
              <span>Portada</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleCoverSelection" />
              <small class="hint">Portada opcional para la tarjeta del lookbook.</small>
              <small v-if="coverFileLabel" class="file-label">{{ coverFileLabel }}</small>
              <small v-if="errors.coverFile" class="field-error">{{ errors.coverFile }}</small>
              <div v-if="currentCoverPreview" class="cover-preview">
                <img :src="currentCoverPreview" alt="Vista previa de portada" />
              </div>
              <div v-if="saving && (form.coverFile || coverUploadProgress)" class="progress-block">
                <div class="progress-bar"><span :style="{ width: `${coverUploadProgress}%` }"></span></div>
                <small>{{ coverUploadProgress }}% portada</small>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <BaseButton variant="secondary" :disabled="saving" @click="closeEditor">Cancelar</BaseButton>
          <BaseButton :disabled="saving" @click="saveLookbook">
            {{ saving ? "Guardando..." : editorMode === "create" ? "Crear lookbook" : "Guardar cambios" }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lookbooks-admin {
  display: grid;
  gap: 20px;
}

.hero-card,
.table-panel {
  padding: 24px;
  border-radius: 24px;
}

.hero-card {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  background:
    radial-gradient(circle at top left, rgba(15, 95, 166, 0.14), transparent 24%),
    linear-gradient(180deg, var(--bg-surface-solid), var(--bg-soft));
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-copy h1,
.panel-head h2,
.modal-head h2 {
  margin: 0;
  color: var(--text-strong);
}

.hero-copy p:last-child,
.panel-head p,
.modal-head p {
  margin: 10px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 20px;
  border-radius: 20px;
}

.stat-card span {
  color: var(--text-muted);
  font-size: 0.86rem;
}

.stat-card strong {
  display: block;
  margin-top: 10px;
  color: var(--text-strong);
  font-size: 1.8rem;
}

.panel-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.empty-state {
  padding: 40px 20px;
  border: 1px dashed var(--border-color);
  border-radius: 18px;
  text-align: center;
  color: var(--text-muted);
}

.empty-state strong {
  color: var(--text-strong);
}

.order-cell {
  min-width: 90px;
}

.order-buttons {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.order-buttons button,
.close-btn,
.action-link {
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  color: var(--text-main);
  border-radius: 10px;
  cursor: pointer;
}

.order-buttons button {
  width: 32px;
  height: 32px;
}

.cover-thumb {
  width: 88px;
  height: 62px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-soft);
  display: grid;
  place-items: center;
  color: var(--text-faint);
  font-size: 0.74rem;
}

.cover-thumb img,
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.doc-copy,
.doc-meta,
.status-stack,
.action-stack {
  display: grid;
  gap: 4px;
}

.doc-copy span,
.doc-meta small,
.status-stack small,
.doc-copy small {
  color: var(--text-muted);
}

.action-stack {
  justify-items: end;
}

.action-link {
  min-width: 108px;
  padding: 8px 10px;
}

.action-link.danger {
  color: var(--danger);
}

.status-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(185, 28, 28, 0.12);
  color: #b91c1c;
  font-size: 0.76rem;
  font-weight: 700;
}

.status-pill.active {
  background: rgba(21, 128, 61, 0.12);
  color: #15803d;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(8, 17, 31, 0.55);
  backdrop-filter: blur(6px);
}

.modal-card {
  width: min(980px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  border-radius: 28px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-lg);
}

.modal-head,
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
}

.modal-head {
  border-bottom: 1px solid var(--border-color);
}

.modal-body {
  padding: 24px;
}

.modal-actions {
  border-top: 1px solid var(--border-color);
  justify-content: flex-end;
}

.close-btn {
  min-height: 40px;
  padding: 0 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: var(--text-strong);
  font-size: 0.88rem;
  font-weight: 700;
}

.field.full-width {
  grid-column: 1 / -1;
}

.toggle-field {
  align-content: start;
}

.checkbox-line {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-main);
}

.checkbox-line input {
  width: 18px;
  height: 18px;
}

.field textarea,
.field input,
.field select {
  padding: 12px 14px;
}

.invalid {
  border-color: var(--danger);
}

.field-error {
  color: var(--danger);
}

.hint,
.file-label {
  color: var(--text-muted);
}

.cover-preview {
  width: 180px;
  height: 120px;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--border-color);
}

.progress-block {
  display: grid;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-muted);
}

.progress-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .hero-card,
  .panel-head,
  .modal-head {
    align-items: start;
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: 12px;
  }

  .modal-body,
  .modal-head,
  .modal-actions,
  .hero-card,
  .table-panel {
    padding-left: 18px;
    padding-right: 18px;
  }

  .action-stack {
    justify-items: stretch;
  }

  .action-link {
    width: 100%;
  }
}
</style>
