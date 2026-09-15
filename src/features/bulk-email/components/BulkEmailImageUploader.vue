<script setup>
import { computed, ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import { formatBytes } from "@/features/lookbooks/admin/services/lookbooksAdmin.service";
import {
  BULK_EMAIL_ATTACHMENT_ACCEPT,
  isCampaignPdf,
} from "../utils/bulkEmailAttachments";

const props = defineProps({
  imageUrl: {
    type: String,
    default: "",
  },
  imagePath: {
    type: String,
    default: "",
  },
  uploading: Boolean,
  disabled: Boolean,
  error: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["upload", "remove"]);
const fileInput = ref(null);
const selectedFile = ref(null);

const fileLabel = computed(() => selectedFile.value?.name || props.imagePath || "Sin archivo cargado");
const fileSize = computed(() => (selectedFile.value ? formatBytes(selectedFile.value.size) : "—"));
const isPdf = computed(() => isCampaignPdf(selectedFile.value || props.imagePath));

function openPicker() {
  fileInput.value?.click();
}

function onFileChange(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }
  selectedFile.value = file;
  emit("upload", file);
}
</script>

<template>
  <section class="image-card">
    <div class="image-preview">
      <img v-if="imageUrl && !isPdf" :src="imageUrl" alt="Vista previa de campaña" />
      <div v-else-if="isPdf" class="pdf-preview">
        <strong>📄 {{ fileLabel }}</strong>
        <span>PDF</span>
        <span>Tamaño: {{ fileSize }}</span>
      </div>
      <div v-else class="placeholder">Sin archivo adjunto</div>
    </div>

    <div class="image-meta">
      <strong>{{ fileLabel }}</strong>
      <span>Tamaño: {{ fileSize }}</span>
      <span>Estado: {{ uploading ? "Subiendo..." : imageUrl || imagePath ? "Disponible" : "Pendiente" }}</span>
      <span v-if="imagePath">Ruta: {{ imagePath }}</span>
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>

    <div class="actions">
      <input
        ref="fileInput"
        type="file"
        :accept="BULK_EMAIL_ATTACHMENT_ACCEPT"
        class="hidden-input"
        @change="onFileChange"
      />
      <BaseButton variant="secondary" :disabled="uploading || disabled" @click="openPicker">
        {{ uploading ? "Subiendo..." : "Subir archivo" }}
      </BaseButton>
      <BaseButton variant="secondary" :disabled="uploading || (!imageUrl && !imagePath) || disabled" @click="emit('remove')">
        Eliminar
      </BaseButton>
    </div>

    <p class="note">
      La tabla actual expone `image_url` e `image_path`; los PDF se envían como adjunto descargable.
    </p>
  </section>
</template>

<style scoped>
.image-card {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 22px;
  background: var(--bg-surface-solid);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.image-preview {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 18px;
  overflow: hidden;
  background: var(--bg-soft);
}

.image-preview img {
  width: 100%;
  height: 100%;
  max-height: 260px;
  object-fit: cover;
}

.placeholder {
  color: var(--text-faint);
  font-weight: 700;
}

.pdf-preview {
  display: grid;
  justify-items: center;
  gap: 8px;
  color: var(--text-muted);
  text-align: center;
}

.pdf-preview strong {
  color: var(--text-strong);
  word-break: break-word;
}

.image-meta {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.image-meta strong {
  color: var(--text-strong);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hidden-input {
  display: none;
}

.note,
.error-text {
  margin: 0;
  font-size: 0.86rem;
}

.note {
  color: var(--text-muted);
}

.error-text {
  color: var(--danger);
}
</style>
