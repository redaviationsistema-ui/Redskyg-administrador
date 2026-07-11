<script setup>
import { computed, reactive, ref, watch } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import {
  LOOKBOOK_CATEGORY_OPTIONS,
  formatBytes,
  formatFileSizeInMb,
  slugifyLookbook,
  validateCoverFile,
  validatePdfFile,
} from "../services/lookbooksAdmin.service";

const props = defineProps({
  open: Boolean,
  mode: {
    type: String,
    default: "create",
  },
  initialValue: {
    type: Object,
    default: () => ({}),
  },
  saving: Boolean,
  uploadState: {
    type: Object,
    default: () => ({
      stage: "idle",
      coverProgress: 0,
      pdfProgress: 0,
      coverStatus: "",
      pdfStatus: "",
    }),
  },
});

const emit = defineEmits(["close", "submit"]);

function createDraft() {
  return {
    title: "",
    slug: "",
    description: "",
    aircraft_name: "",
    category: LOOKBOOK_CATEGORY_OPTIONS[0] || "",
    cover_url: "",
    pdf_path: "",
    pages: "",
    size_mb: "",
    is_active: true,
    requires_login: false,
    order_index: "",
  };
}

const draft = reactive(createDraft());
const errors = reactive({});
const coverPreviewUrl = ref("");
const coverFile = ref(null);
const pdfFile = ref(null);
const coverFileName = ref("");
const pdfFileName = ref("");
const pdfFileSizeLabel = ref("");
const slugEditedManually = ref(false);

const titleText = computed(() =>
  props.mode === "create" ? "Nuevo lookbook" : "Editar lookbook",
);

const saveLabel = computed(() => {
  if (props.saving) {
    switch (props.uploadState?.stage) {
      case "subiendo_archivos":
        return "Subiendo archivos...";
      case "guardando":
        return "Guardando...";
      case "finalizando":
        return "Actualizando...";
      default:
        return "Guardando...";
    }
  }

  return props.mode === "create" ? "Crear lookbook" : "Guardar cambios";
});

function clearErrors() {
  Object.keys(errors).forEach((key) => {
    delete errors[key];
  });
}

function syncDraft() {
  Object.assign(draft, createDraft(), {
    ...props.initialValue,
    slug: props.initialValue?.slug || "",
    pages: props.initialValue?.pages ?? "",
    size_mb: props.initialValue?.size_mb ?? "",
    order_index: props.initialValue?.order_index ?? "",
    is_active: props.initialValue?.is_active ?? true,
    requires_login: props.initialValue?.requires_login ?? false,
  });

  slugEditedManually.value = Boolean(props.initialValue?.slug);
  coverPreviewUrl.value = props.initialValue?.cover_preview_url || props.initialValue?.cover_url || "";
  coverFile.value = null;
  pdfFile.value = null;
  coverFileName.value = "";
  pdfFileName.value = props.initialValue?.pdf_path || "";
  pdfFileSizeLabel.value = props.initialValue?.size_mb ? `${props.initialValue.size_mb} MB` : "";
  clearErrors();
}

async function updateCoverPreview(file) {
  coverPreviewUrl.value = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("No fue posible generar la vista previa de la portada."));
    reader.readAsDataURL(file);
  });
}

function validateForm() {
  clearErrors();

  if (!draft.title?.trim()) {
    errors.title = "El título es obligatorio.";
  }

  if (!draft.slug?.trim()) {
    errors.slug = "El slug es obligatorio.";
  }

  if (!draft.category?.trim()) {
    errors.category = "La categoría es obligatoria.";
  }

  if (!draft.pdf_path?.trim() && !pdfFile.value) {
    errors.pdf_path = "Debes subir un archivo PDF.";
  }

  if (coverFile.value) {
    const coverError = validateCoverFile(coverFile.value);
    if (coverError) {
      errors.coverFile = coverError;
    }
  }

  if (pdfFile.value) {
    const pdfError = validatePdfFile(pdfFile.value);
    if (pdfError) {
      errors.pdfFile = pdfError;
    }
  }

  return Object.keys(errors).length === 0;
}

function onTitleInput() {
  if (!slugEditedManually.value) {
    draft.slug = slugifyLookbook(draft.title);
  }
}

function onSlugInput() {
  slugEditedManually.value = true;
}

async function onCoverSelected(event) {
  const [file] = event.target.files || [];
  coverFile.value = null;
  coverFileName.value = "";
  delete errors.coverFile;

  if (!file) {
    return;
  }

  const validationMessage = validateCoverFile(file);
  if (validationMessage) {
    errors.coverFile = validationMessage;
    return;
  }

  coverFile.value = file;
  coverFileName.value = file.name;
  await updateCoverPreview(file);
}

function onPdfSelected(event) {
  const [file] = event.target.files || [];
  pdfFile.value = null;
  pdfFileName.value = "";
  pdfFileSizeLabel.value = "";
  delete errors.pdfFile;

  if (!file) {
    return;
  }

  const validationMessage = validatePdfFile(file);
  if (validationMessage) {
    errors.pdfFile = validationMessage;
    return;
  }

  pdfFile.value = file;
  pdfFileName.value = file.name;
  pdfFileSizeLabel.value = formatBytes(file.size);
  draft.size_mb = formatFileSizeInMb(file.size);
}

function submit() {
  if (!validateForm()) {
    return;
  }

  emit("submit", {
    values: {
      ...draft,
      slug: slugifyLookbook(draft.slug || draft.title),
      current_cover_url: props.initialValue?.cover_url || "",
      current_pdf_path: props.initialValue?.pdf_path || "",
    },
    files: {
      coverFile: coverFile.value,
      pdfFile: pdfFile.value,
    },
  });
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      syncDraft();
    }
  },
  { immediate: true },
);

watch(
  () => props.initialValue,
  () => {
    if (props.open) {
      syncDraft();
    }
  },
);
</script>

<template>
  <BaseModal :open="open" :title="titleText" max-width="1120px" hide-footer @close="emit('close')">
    <div class="lookbook-form">
      <div class="form-grid">
        <label class="field">
          <span>Título</span>
          <input v-model="draft.title" type="text" placeholder="Bell 505 Specifications" @input="onTitleInput" />
          <small v-if="errors.title" class="error-text">{{ errors.title }}</small>
        </label>

        <label class="field">
          <span>Slug</span>
          <input v-model="draft.slug" type="text" placeholder="bell-505-specifications" @input="onSlugInput" />
          <small v-if="errors.slug" class="error-text">{{ errors.slug }}</small>
        </label>

        <label class="field field-span-2">
          <span>Descripción</span>
          <textarea v-model="draft.description" rows="4" placeholder="Resumen del contenido del lookbook"></textarea>
        </label>

        <label class="field">
          <span>Aeronave</span>
          <input v-model="draft.aircraft_name" type="text" placeholder="Bell 505" />
        </label>

        <label class="field">
          <span>Categoría</span>
          <select v-model="draft.category">
            <option v-for="option in LOOKBOOK_CATEGORY_OPTIONS" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
          <small v-if="errors.category" class="error-text">{{ errors.category }}</small>
        </label>

        <label class="field">
          <span>Páginas</span>
          <input v-model="draft.pages" type="number" min="1" placeholder="24" />
        </label>

        <label class="field">
          <span>Orden</span>
          <input v-model="draft.order_index" type="number" min="0" placeholder="1" />
        </label>

        <label class="field">
          <span>Estado</span>
          <select v-model="draft.is_active">
            <option :value="true">Activo</option>
            <option :value="false">Inactivo</option>
          </select>
        </label>

        <label class="field">
          <span>Acceso</span>
          <select v-model="draft.requires_login">
            <option :value="false">Público</option>
            <option :value="true">Protegido</option>
          </select>
        </label>
      </div>

      <div class="uploads-grid">
        <section class="upload-card">
          <div class="upload-head">
            <div>
              <h4>Portada</h4>
              <p>Formatos permitidos: JPG, JPEG, PNG, WEBP. Máximo 4 MB.</p>
            </div>
          </div>

          <div class="cover-preview">
            <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="Vista previa de portada" />
            <div v-else class="cover-placeholder">Sin portada</div>
          </div>

          <label class="field">
            <span>Imagen de portada</span>
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" @change="onCoverSelected" />
          </label>

          <div class="file-meta">
            <span><strong>Archivo:</strong> {{ coverFileName || "Sin cambios" }}</span>
            <span><strong>Estado:</strong> {{ uploadState.coverStatus || (coverFile ? "Listo para subir" : "Pendiente") }}</span>
            <span><strong>Progreso:</strong> {{ uploadState.coverProgress || 0 }}%</span>
          </div>

          <small v-if="errors.coverFile" class="error-text">{{ errors.coverFile }}</small>
        </section>

        <section class="upload-card">
          <div class="upload-head">
            <div>
              <h4>Documento PDF</h4>
              <p>Formato permitido: PDF. Máximo 50 MB.</p>
            </div>
          </div>

          <label class="field">
            <span>Archivo PDF</span>
            <input type="file" accept=".pdf,application/pdf" @change="onPdfSelected" />
          </label>

          <div class="file-meta">
            <span><strong>Archivo:</strong> {{ pdfFileName || "Sin archivo seleccionado" }}</span>
            <span><strong>Tamaño:</strong> {{ pdfFileSizeLabel || (draft.size_mb ? `${draft.size_mb} MB` : "Pendiente") }}</span>
            <span><strong>Estado:</strong> {{ uploadState.pdfStatus || (pdfFile ? "Listo para subir" : "Pendiente") }}</span>
            <span><strong>Progreso:</strong> {{ uploadState.pdfProgress || 0 }}%</span>
          </div>

          <div class="field">
            <span>Ruta guardada</span>
            <input :value="draft.pdf_path || 'Se completará al guardar'" type="text" readonly />
            <small v-if="errors.pdf_path" class="error-text">{{ errors.pdf_path }}</small>
            <small v-if="errors.pdfFile" class="error-text">{{ errors.pdfFile }}</small>
          </div>
        </section>
      </div>

      <div class="modal-actions">
        <BaseButton variant="secondary" :disabled="saving" @click="emit('close')">Cancelar</BaseButton>
        <BaseButton :disabled="saving" @click="submit">{{ saveLabel }}</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.lookbook-form {
  display: grid;
  gap: 22px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-strong);
}

.field input,
.field select,
.field textarea {
  padding: 12px 14px;
}

.field-span-2 {
  grid-column: span 2;
}

.uploads-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.upload-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: var(--bg-soft);
}

.upload-head h4 {
  margin: 0 0 4px;
  color: var(--text-strong);
}

.upload-head p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.cover-preview {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  overflow: hidden;
  background: var(--bg-surface-solid);
  border: 1px dashed var(--border-strong);
}

.cover-preview img {
  width: 100%;
  height: 100%;
  max-height: 260px;
  object-fit: cover;
}

.cover-placeholder {
  color: var(--text-faint);
  font-weight: 700;
}

.file-meta {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: var(--bg-surface-solid);
  border: 1px solid var(--border-color);
  font-size: 0.88rem;
  color: var(--text-muted);
}

.error-text {
  color: var(--danger);
  font-size: 0.82rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 900px) {
  .form-grid,
  .uploads-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: span 1;
  }
}

@media (max-width: 640px) {
  .modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
