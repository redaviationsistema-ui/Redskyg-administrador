<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import { uploadVillaImages } from "../services/experienceGallery.service";
import { validateExperienceFile } from "../utils/experienceFileValidation";

const props = defineProps({ villa: { type: Object, required: true } });
const emit = defineEmits(["uploaded", "close"]);
const input = ref(null);
const entries = ref([]);
const dragging = ref(false);
const uploading = ref(false);
const batchProgress = ref(0);

const validFiles = computed(() => entries.value.filter((entry) => !entry.error).map((entry) => entry.file));

function addFiles(fileList) {
  for (const file of Array.from(fileList || [])) {
    const duplicate = entries.value.some((entry) => entry.file.name === file.name && entry.file.size === file.size);
    if (duplicate) continue;
    entries.value.push({ file, url: URL.createObjectURL(file), error: validateExperienceFile(file) });
  }
}

function remove(index) {
  URL.revokeObjectURL(entries.value[index].url);
  entries.value.splice(index, 1);
}

function drop(event) {
  dragging.value = false;
  addFiles(event.dataTransfer.files);
}

async function upload() {
  if (!validFiles.value.length || uploading.value) return;
  uploading.value = true;
  batchProgress.value = 0;
  try {
    await uploadVillaImages(props.villa, validFiles.value, (value) => { batchProgress.value = value; });
    emit("uploaded");
  } catch (error) {
    if (error.name !== "AbortError") entries.value = entries.value.map((entry) => entry.error ? entry : { ...entry, error: error.message });
  } finally {
    uploading.value = false;
  }
}

function retry() {
  entries.value = entries.value.map((entry) => ({ ...entry, error: validateExperienceFile(entry.file) }));
  upload();
}

onBeforeUnmount(() => entries.value.forEach((entry) => URL.revokeObjectURL(entry.url)));
</script>

<template>
  <div class="uploader">
    <div
      class="drop-zone"
      :class="{ dragging }"
      @dragenter.prevent="dragging = true"
      @dragover.prevent
      @dragleave.prevent="dragging = false"
      @drop.prevent="drop"
      @click="input?.click()"
    >
      <input ref="input" hidden multiple type="file" accept=".jpg,.jpeg,.png,.webp,.avif" @change="addFiles($event.target.files)" />
      <strong>Arrastra tus imágenes aquí</strong>
      <span>o haz clic para seleccionar · JPG, PNG, WebP o AVIF · máximo 15 MB</span>
    </div>

    <div v-if="entries.length" class="preview-list">
      <article v-for="(entry, index) in entries" :key="`${entry.file.name}-${entry.file.size}`" class="preview-item">
        <img :src="entry.url" alt="" />
        <div><strong>{{ entry.file.name }}</strong><span>{{ (entry.file.size / 1048576).toFixed(2) }} MB</span><small v-if="entry.error">{{ entry.error }}</small></div>
        <button type="button" aria-label="Quitar archivo" :disabled="uploading" @click="remove(index)">×</button>
      </article>
    </div>

    <div v-if="uploading" class="progress" role="progressbar" :aria-valuenow="batchProgress"><span :style="{ width: `${batchProgress}%` }" /></div>
    <div class="actions">
      <BaseButton variant="secondary" :disabled="uploading" @click="emit('close')">Cancelar</BaseButton>
      <BaseButton v-if="entries.some((entry) => entry.error)" variant="secondary" :disabled="uploading" @click="retry">Reintentar</BaseButton>
      <BaseButton :disabled="uploading || !validFiles.length" @click="upload">{{ uploading ? 'Subiendo…' : `Subir ${validFiles.length} imagen${validFiles.length === 1 ? '' : 'es'}` }}</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.uploader,.preview-list{display:grid;gap:14px}.drop-zone{display:grid;place-items:center;gap:6px;min-height:180px;padding:24px;border:2px dashed var(--border-strong);border-radius:20px;background:var(--bg-soft);color:var(--text-muted);cursor:pointer;text-align:center;transition:.2s}.drop-zone.dragging{border-color:var(--primary);background:var(--primary-soft);transform:scale(1.01)}.drop-zone strong{color:var(--text-strong);font-size:1.05rem}.preview-list{max-height:300px;overflow:auto}.preview-item{display:grid;grid-template-columns:64px 1fr auto;align-items:center;gap:12px;padding:10px;border:1px solid var(--border-color);border-radius:14px}.preview-item img{width:64px;height:52px;object-fit:cover;border-radius:10px}.preview-item div{display:grid;min-width:0}.preview-item strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.preview-item span{color:var(--text-muted);font-size:.8rem}.preview-item small{color:var(--danger)}.preview-item button{background:transparent;color:var(--text-muted);font-size:1.5rem;cursor:pointer}.progress{height:8px;overflow:hidden;border-radius:999px;background:var(--bg-muted)}.progress span{display:block;height:100%;background:var(--primary);transition:width .15s}.actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px}
</style>
