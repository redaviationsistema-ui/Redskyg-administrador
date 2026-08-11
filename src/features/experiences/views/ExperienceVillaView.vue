<script setup>
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import { useFeedback } from "@/composables/useFeedback";
import ExperienceUploader from "../components/ExperienceUploader.vue";
import { deleteVillaImage, getVillaBySlug, listVillaImages, reorderVillaImages, setVillaActive, setVillaCover, setVillaImageActive } from "../services/experienceGallery.service";

const props = defineProps({ slug: { type: String, required: true } });
const router = useRouter(); const feedback = useFeedback();
const villa = ref(null); const images = ref([]); const loading = ref(true); const uploadOpen = ref(false); const preview = ref(null); const dragged = ref(null);

async function load() {
  loading.value = true;
  try { villa.value = await getVillaBySlug(props.slug); images.value = await listVillaImages(villa.value.id); }
  catch (error) { feedback.error("No se pudo cargar la villa", error); }
  finally { loading.value = false; }
}

async function uploaded() { uploadOpen.value = false; images.value = await listVillaImages(villa.value.id); feedback.notify("Imágenes agregadas"); }

async function cover(image) {
  try { await setVillaCover(villa.value.id, image.id); villa.value.cover_path = image.image_path; images.value = images.value.map((item) => ({ ...item, is_cover: item.id === image.id, is_active: item.id === image.id ? true : item.is_active })); feedback.notify("Portada actualizada"); }
  catch (error) { feedback.error("No se pudo cambiar la portada", error); }
}

async function toggleVilla() {
  const previous = villa.value.is_active;
  villa.value.is_active = !previous;
  try { await setVillaActive(villa.value.id, villa.value.is_active); feedback.notify(villa.value.is_active ? "Villa publicada" : "Villa oculta"); }
  catch (error) { villa.value.is_active = previous; feedback.error("No se pudo cambiar el estado", error); }
}

async function toggleImage(image, event) {
  const previous = image.is_active;
  if (previous && image.is_cover) {
    event.target.checked = true;
    feedback.warning("La portada debe permanecer visible", "Elige otra imagen como portada antes de ocultarla.");
    return;
  }
  image.is_active = !previous;
  try { await setVillaImageActive(image.id, image.is_active); feedback.notify(image.is_active ? "Imagen visible" : "Imagen oculta"); }
  catch (error) { image.is_active = previous; feedback.error("No se pudo cambiar la visibilidad", error); }
}

function openPublicPreview() {
  window.open(router.resolve("/landing/es-mx/experiencias").href, "_blank", "noopener,noreferrer");
}

async function remove(image) {
  const result = await feedback.confirm({ title: "¿Eliminar esta imagen?", text: "Se eliminará permanentemente de la galería.", confirmButtonText: "Eliminar", cancelButtonText: "Cancelar", icon: "warning", confirmButtonColor: "#c62828" });
  if (!result.isConfirmed) return;
  try { await deleteVillaImage(image); images.value = images.value.filter((item) => item.id !== image.id); if (image.is_cover) villa.value.cover_path = null; feedback.notify("Imagen eliminada"); }
  catch (error) { feedback.error("No se pudo eliminar la imagen", error); }
}

async function dropAt(index) {
  if (dragged.value === null || dragged.value === index) return;
  const previous = [...images.value]; const next = [...images.value]; const [item] = next.splice(dragged.value,1); next.splice(index,0,item);
  images.value = next.map((image,position) => ({ ...image, sort_order: position + 1 })); dragged.value = null;
  try { await reorderVillaImages(images.value); feedback.notify("Orden actualizado"); }
  catch (error) { images.value = previous; feedback.error("No se pudo guardar el orden", error); }
}

watch(() => props.slug, load); onMounted(load);
</script>

<template>
  <main class="page-shell detail-page">
    <button class="back" @click="router.push('/admin/experiencias')">← Regresar</button>
    <header v-if="villa" class="page-header"><div><p class="eyebrow">Experiencias</p><h1>{{ villa.name }}</h1><p>{{ villa.destination }}</p><p>{{ images.length }} fotografías</p><label class="villa-status"><input type="checkbox" :checked="villa.is_active" @change="toggleVilla"><span>{{ villa.is_active ? "Publicada" : "Oculta" }}</span></label></div><div class="header-actions"><BaseButton variant="secondary" @click="openPublicPreview">Vista previa</BaseButton><BaseButton @click="uploadOpen=true">+ Agregar imágenes</BaseButton></div></header>
    <section v-if="loading" class="loading">Cargando galería…</section>
    <section v-else-if="images.length" class="image-grid">
      <article v-for="(image,index) in images" :key="image.id" class="image-card" draggable="true" @dragstart="dragged=index" @dragover.prevent @drop.prevent="dropAt(index)">
        <button class="photo" @click="preview=image"><img :src="image.image_url" :alt="`Fotografía de ${villa.name}`" loading="lazy"><span v-if="image.is_cover">Portada</span></button>
        <label class="image-visible"><input type="checkbox" :checked="image.is_active" @change="toggleImage(image, $event)"><span>{{ image.is_active ? "✓ Visible" : "Oculta" }}</span></label><div class="image-actions"><button @click="preview=image">Ver</button><button :disabled="image.is_cover" @click="cover(image)">{{ image.is_cover ? "★ Portada" : "Establecer como portada" }}</button><button class="danger" @click="remove(image)">Eliminar</button><span>↕</span></div>
      </article>
    </section>
    <section v-else-if="villa" class="empty"><strong>Esta villa aún no tiene fotografías</strong><p>Agrega imágenes y elige una como portada.</p><BaseButton @click="uploadOpen=true">+ Agregar imágenes</BaseButton></section>
    <BaseModal :open="uploadOpen" title="Agregar imágenes" max-width="760px" hide-footer @close="uploadOpen=false"><ExperienceUploader v-if="villa" :villa="villa" @uploaded="uploaded" @close="uploadOpen=false" /></BaseModal>
    <BaseModal :open="Boolean(preview)" title="Vista previa" max-width="1000px" @close="preview=null"><img v-if="preview" class="preview" :src="preview.image_url" :alt="villa?.name"></BaseModal>
  </main>
</template>

<style scoped>
.detail-page{display:grid;gap:20px}.back{width:max-content;padding:0;background:none;color:var(--primary);font-weight:800;cursor:pointer}.page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-header h1{margin:3px 0 5px;color:var(--text-strong);font-size:clamp(1.7rem,3vw,2.5rem)}.page-header p{margin:0;color:var(--text-muted)}.eyebrow{color:var(--primary)!important;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.image-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.image-card{overflow:hidden;border:1px solid var(--border-color);border-radius:18px;background:var(--bg-surface-solid);box-shadow:var(--shadow-sm)}.photo{position:relative;width:100%;height:210px;padding:0;background:var(--bg-muted);cursor:zoom-in}.photo img{width:100%;height:100%;object-fit:cover}.photo span{position:absolute;top:10px;left:10px;padding:5px 9px;border-radius:999px;background:var(--primary);color:#fff;font-size:.72rem;font-weight:800}.image-actions{display:flex;align-items:center;flex-wrap:wrap;gap:9px;padding:12px}.image-actions button{padding:0;background:none;color:var(--primary);font-size:.78rem;font-weight:800;cursor:pointer}.image-actions button:disabled{color:var(--success);cursor:default}.image-actions .danger{color:var(--danger)}.image-actions span{margin-left:auto;color:var(--text-faint);cursor:grab}.empty,.loading{display:grid;place-items:center;min-height:320px;padding:30px;border:1px dashed var(--border-strong);border-radius:22px;background:var(--bg-surface)}.empty p{color:var(--text-muted)}.preview{display:block;max-height:72vh;margin:auto;border-radius:14px;object-fit:contain}@media(max-width:1100px){.image-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:800px){.image-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.page-header{align-items:stretch;flex-direction:column}.image-grid{grid-template-columns:1fr}}
.header-actions{display:flex;gap:10px;flex-wrap:wrap}.villa-status,.image-visible{display:flex;align-items:center;gap:7px;width:max-content;font-size:.82rem;font-weight:800}.villa-status{margin-top:10px}.villa-status input,.image-visible input{width:18px}.image-visible{padding:10px 12px 0;color:var(--success)}
</style>
