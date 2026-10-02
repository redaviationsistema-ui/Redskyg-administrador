<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import { useFeedback } from "@/composables/useFeedback";
import AircraftSalesUploader from "../components/AircraftSalesUploader.vue";
import {
  aircraftStatusLabels,
  createAircraftPdfSignedUrl,
  deleteAircraftPdf,
  getAircraftBySlug,
  listAircraftImages,
  reorderAircraftImages,
  setAircraftActive,
  setAircraftCover,
  setAircraftImageActive,
  updateAircraft,
  deleteAircraftImage,
  uploadAircraftPdf,
} from "../services/aircraftSales.service";

const props = defineProps({ slug: { type: String, required: true } });
const router = useRouter();
const feedback = useFeedback();
const aircraft = ref(null);
const images = ref([]);
const loading = ref(true);
const saving = ref(false);
const uploadOpen = ref(false);
const pdfInput = ref(null);
const pdfBusy = ref(false);
const pdfStatus = ref("");
const preview = ref(null);
const dragged = ref(null);
const form = reactive({ name: "", manufacturer: "", model: "", registration: "", price: null, currency: "USD", status: "ready_to_operate", description: "", is_active: false });

const imageCountLabel = computed(() => `${images.value.length} imagen${images.value.length === 1 ? "" : "es"}`);

function fillForm(record) {
  Object.assign(form, {
    name: record.name || "",
    manufacturer: record.manufacturer || "",
    model: record.model || "",
    registration: record.registration || "",
    price: record.price ?? null,
    currency: record.currency || "USD",
    status: record.status || "ready_to_operate",
    description: record.description || "",
    is_active: Boolean(record.is_active),
  });
}

async function load() {
  loading.value = true;
  try {
    aircraft.value = await getAircraftBySlug(props.slug);
    fillForm(aircraft.value);
    images.value = await listAircraftImages(aircraft.value.id);
  } catch (error) { feedback.error("No se pudo cargar la aeronave", error); }
  finally { loading.value = false; }
}

async function save() {
  if (!aircraft.value) return;
  saving.value = true;
  try {
    const updated = await updateAircraft(aircraft.value.id, {
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim() || null,
      model: form.model.trim() || null,
      registration: form.registration.trim().toUpperCase(),
      price: form.price ? Number(form.price) : null,
      currency: form.currency || "USD",
      status: form.status,
      description: form.description.trim() || null,
      is_active: Boolean(form.is_active),
    });
    aircraft.value = updated;
    fillForm(updated);
    feedback.notify("Aeronave actualizada");
    if (updated.slug !== props.slug) router.replace(`/admin/aircraft-sales/${updated.slug}`);
  } catch (error) { feedback.error("No se pudo guardar la aeronave", error); }
  finally { saving.value = false; }
}

async function uploaded() {
  uploadOpen.value = false;
  images.value = await listAircraftImages(aircraft.value.id);
  feedback.notify("Imagenes agregadas");
}

function choosePdf() {
  pdfInput.value?.click();
}

async function uploadPdf(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !aircraft.value) return;
  pdfBusy.value = true;
  pdfStatus.value = "Subiendo...";
  try {
    aircraft.value = await uploadAircraftPdf(aircraft.value, file);
    fillForm(aircraft.value);
    pdfStatus.value = "Documento cargado correctamente.";
    feedback.notify("Documento cargado correctamente");
  } catch (error) {
    pdfStatus.value = "Error al subir";
    feedback.error("No se pudo guardar el PDF", error);
  } finally {
    pdfBusy.value = false;
  }
}

async function viewPdf() {
  if (!aircraft.value?.pdf_path) return;
  pdfBusy.value = true;
  try {
    const signedUrl = await createAircraftPdfSignedUrl(aircraft.value.pdf_path);
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) { feedback.error("No se pudo abrir el PDF", error); }
  finally { pdfBusy.value = false; }
}

async function removePdf() {
  if (!aircraft.value?.pdf_path) return;
  const result = await feedback.confirm({ title: "Eliminar documento", text: `Deseas eliminar el documento asociado a ${aircraft.value.name} - ${aircraft.value.registration}?`, confirmButtonText: "Eliminar", cancelButtonText: "Cancelar", icon: "warning", confirmButtonColor: "#c62828" });
  if (!result.isConfirmed) return;
  pdfBusy.value = true;
  try {
    aircraft.value = await deleteAircraftPdf(aircraft.value);
    fillForm(aircraft.value);
    pdfStatus.value = "Documento eliminado.";
    feedback.notify("Documento eliminado");
  } catch (error) { feedback.error("No se pudo eliminar el PDF", error); }
  finally { pdfBusy.value = false; }
}

async function cover(image) {
  try {
    await setAircraftCover(aircraft.value.id, image.id);
    images.value = images.value.map((item) => ({ ...item, is_cover: item.id === image.id, is_active: item.id === image.id ? true : item.is_active }));
    feedback.notify("Portada actualizada");
  } catch (error) { feedback.error("No se pudo cambiar la portada", error); }
}

async function toggleActive() {
  const previous = form.is_active;
  form.is_active = !previous;
  try { await setAircraftActive(aircraft.value.id, form.is_active); feedback.notify(form.is_active ? "Aeronave publicada" : "Aeronave oculta"); }
  catch (error) { form.is_active = previous; feedback.error("No se pudo cambiar el estado", error); }
}

async function toggleImage(image, event) {
  const previous = image.is_active;
  if (previous && image.is_cover) {
    event.target.checked = true;
    feedback.warning("La portada debe permanecer visible", "Elige otra imagen como portada antes de ocultarla.");
    return;
  }
  image.is_active = !previous;
  try { await setAircraftImageActive(image.id, image.is_active); feedback.notify(image.is_active ? "Imagen visible" : "Imagen oculta"); }
  catch (error) { image.is_active = previous; feedback.error("No se pudo cambiar la visibilidad", error); }
}

async function remove(image) {
  const result = await feedback.confirm({ title: "Eliminar imagen", text: "Se eliminara permanentemente de la galeria.", confirmButtonText: "Eliminar", cancelButtonText: "Cancelar", icon: "warning", confirmButtonColor: "#c62828" });
  if (!result.isConfirmed) return;
  try { await deleteAircraftImage(image); images.value = images.value.filter((item) => item.id !== image.id); feedback.notify("Imagen eliminada"); }
  catch (error) { feedback.error("No se pudo eliminar la imagen", error); }
}

async function dropAt(index) {
  if (dragged.value === null || dragged.value === index) return;
  const previous = [...images.value];
  const next = [...images.value];
  const [item] = next.splice(dragged.value, 1);
  next.splice(index, 0, item);
  images.value = next.map((image, position) => ({ ...image, display_order: position + 1 }));
  dragged.value = null;
  try { await reorderAircraftImages(images.value); feedback.notify("Orden actualizado"); }
  catch (error) { images.value = previous; feedback.error("No se pudo guardar el orden", error); }
}

watch(() => props.slug, load);
onMounted(load);
</script>

<template>
  <main class="page-shell detail-page">
    <button class="back" @click="router.push('/admin/aircraft-sales')">← Regresar</button>
    <section v-if="loading" class="state-box">Cargando aeronave...</section>
    <template v-else-if="aircraft">
      <header class="page-header">
        <div><p class="eyebrow">Aircraft Sales</p><h1>{{ aircraft.name }}</h1><p>{{ aircraft.registration }} · {{ aircraftStatusLabels[form.status] }}</p></div>
        <div class="header-actions"><BaseButton variant="secondary" @click="toggleActive">{{ form.is_active ? "Ocultar" : "Publicar" }}</BaseButton><BaseButton :disabled="saving" @click="save">{{ saving ? "Guardando..." : "Guardar cambios" }}</BaseButton></div>
      </header>

      <section class="form-panel">
        <h2>Informacion de la aeronave</h2>
        <div class="form-grid">
          <label><span>Nombre *</span><input v-model.trim="form.name" required></label>
          <label><span>Fabricante</span><input v-model.trim="form.manufacturer"></label>
          <label><span>Modelo</span><input v-model.trim="form.model"></label>
          <label><span>Matricula *</span><input v-model.trim="form.registration" required></label>
          <label><span>Precio</span><input v-model.number="form.price" type="number" min="0" step="1"></label>
          <label><span>Moneda</span><input v-model.trim="form.currency" maxlength="3"></label>
          <label><span>Estado</span><select v-model="form.status"><option value="ready_to_operate">Listo para operar</option><option value="out_of_service">Fuera de servicio</option></select></label>
          <label class="published"><input v-model="form.is_active" type="checkbox"><span>Publicado</span></label>
          <label class="full"><span>Descripcion</span><textarea v-model.trim="form.description" rows="5"></textarea></label>
        </div>
      </section>

      <section class="document-panel">
        <div class="section-head"><div><h2>Documentacion comercial</h2><p>{{ aircraft.registration }}</p></div></div>
        <input ref="pdfInput" class="hidden-input" type="file" accept="application/pdf" @change="uploadPdf">
        <div class="document-box">
          <div>
            <span class="document-state" :class="{ missing: !aircraft.pdf_path }">{{ aircraft.pdf_path ? "PDF cargado" : "Sin PDF" }}</span>
            <strong>{{ aircraft.pdf_path ? aircraft.pdf_path.split('/').pop() : "Documento comercial" }}</strong>
            <p>{{ pdfStatus || (aircraft.pdf_path ? "Disponible mediante URL firmada temporal." : "Sube el PDF comercial asociado a esta aeronave.") }}</p>
          </div>
          <div class="document-actions">
            <BaseButton v-if="aircraft.pdf_path" variant="secondary" :disabled="pdfBusy" @click="viewPdf">Ver PDF</BaseButton>
            <BaseButton :disabled="pdfBusy" @click="choosePdf">{{ aircraft.pdf_path ? "Reemplazar PDF" : "Subir PDF" }}</BaseButton>
            <BaseButton v-if="aircraft.pdf_path" variant="secondary" :disabled="pdfBusy" @click="removePdf">Eliminar PDF</BaseButton>
          </div>
        </div>
      </section>

      <section class="gallery-panel">
        <div class="section-head"><div><h2>Imagenes de la aeronave</h2><p>{{ imageCountLabel }}</p></div><BaseButton @click="uploadOpen=true">+ Subir imagenes</BaseButton></div>
        <div v-if="images.length" class="image-grid">
          <article v-for="(image,index) in images" :key="image.id" class="image-card" draggable="true" @dragstart="dragged=index" @dragover.prevent @drop.prevent="dropAt(index)">
            <button class="photo" @click="preview=image"><img :src="image.image_url" :alt="aircraft.name" loading="lazy"><span v-if="image.is_cover">Portada</span></button>
            <label class="image-visible"><input type="checkbox" :checked="image.is_active" @change="toggleImage(image, $event)"><span>{{ image.is_active ? "Visible" : "Oculta" }}</span></label>
            <div class="image-actions"><button @click="preview=image">Ver</button><button :disabled="image.is_cover" @click="cover(image)">{{ image.is_cover ? "Principal" : "Hacer portada" }}</button><button class="danger" @click="remove(image)">Eliminar</button><span>↕</span></div>
          </article>
        </div>
        <div v-else class="empty"><strong>Esta aeronave todavia no tiene imagenes.</strong><BaseButton @click="uploadOpen=true">Subir imagenes</BaseButton></div>
      </section>
    </template>
    <BaseModal :open="uploadOpen" title="Agregar imagenes" max-width="760px" hide-footer @close="uploadOpen=false"><AircraftSalesUploader v-if="aircraft" :aircraft="aircraft" @uploaded="uploaded" @close="uploadOpen=false" /></BaseModal>
    <BaseModal :open="Boolean(preview)" title="Vista previa" max-width="1000px" @close="preview=null"><img v-if="preview" class="preview" :src="preview.image_url" :alt="aircraft?.name"></BaseModal>
  </main>
</template>

<style scoped>
.detail-page{display:grid;gap:20px}.back{width:max-content;padding:0;background:none;color:var(--primary);font-weight:800;cursor:pointer}.page-header,.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-header h1{margin:3px 0 5px;color:var(--text-strong);font-size:clamp(1.7rem,3vw,2.5rem)}.page-header p,.section-head p{margin:0;color:var(--text-muted)}.eyebrow{color:var(--primary)!important;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.header-actions{display:flex;gap:10px;flex-wrap:wrap}.form-panel,.gallery-panel,.state-box{padding:18px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface-solid);box-shadow:var(--shadow-sm)}.form-panel h2,.gallery-panel h2{margin:0 0 14px;color:var(--text-strong)}.form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.form-grid label{display:grid;gap:7px;color:var(--text-muted);font-size:.82rem;font-weight:800}.form-grid input,.form-grid select,.form-grid textarea{width:100%;border:1px solid var(--border-strong);border-radius:8px;background:var(--bg-soft);padding:11px;color:var(--text-main);font:inherit}.published{align-content:end}.published input{width:auto}.full{grid-column:1/-1}.image-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:16px}.image-card{overflow:hidden;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface-solid)}.photo{position:relative;width:100%;height:210px;padding:0;background:var(--bg-muted);cursor:zoom-in}.photo img{width:100%;height:100%;object-fit:cover}.photo span{position:absolute;top:10px;left:10px;padding:5px 9px;border-radius:999px;background:var(--primary);color:#fff;font-size:.72rem;font-weight:800}.image-visible{display:flex;align-items:center;gap:7px;width:max-content;padding:10px 12px 0;color:var(--success);font-size:.82rem;font-weight:800}.image-visible input{width:18px}.image-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px;padding:12px}.image-actions button{padding:0;background:none;color:var(--primary);font-size:.78rem;font-weight:800;cursor:pointer}.image-actions button:disabled{color:var(--success);cursor:default}.image-actions .danger{color:var(--danger)}.image-actions span{margin-left:auto;color:var(--text-faint);cursor:grab}.empty{display:grid;place-items:center;gap:14px;min-height:260px;margin-top:16px;padding:30px;border:1px dashed var(--border-strong);border-radius:8px;background:var(--bg-surface);color:var(--text-muted)}.preview{display:block;max-height:72vh;margin:auto;border-radius:8px;object-fit:contain}@media(max-width:1100px){.form-grid,.image-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.page-header,.section-head{align-items:stretch;flex-direction:column}.form-grid,.image-grid{grid-template-columns:1fr}}
.document-panel{padding:18px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface-solid);box-shadow:var(--shadow-sm)}.document-panel h2{margin:0 0 4px;color:var(--text-strong)}.hidden-input{display:none}.document-box{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-soft)}.document-box strong{display:block;margin-top:8px;color:var(--text-strong);word-break:break-word}.document-box p{margin:5px 0 0;color:var(--text-muted)}.document-state{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(22,163,74,.12);color:var(--success);font-size:.74rem;font-weight:800}.document-state.missing{background:rgba(217,119,6,.12);color:#b45309}.document-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}@media(max-width:640px){.document-box{align-items:stretch;flex-direction:column}.document-actions{justify-content:flex-start}}
</style>
