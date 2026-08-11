<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import { useFeedback } from "@/composables/useFeedback";
import { createVilla, deleteVilla, listVillas, reorderVillas, setVillaActive, slugifyVillaName } from "../services/experienceGallery.service";

const router = useRouter();
const feedback = useFeedback();
const villas = ref([]);
const loading = ref(true);
const creating = ref(false);
const createOpen = ref(false);
const name = ref("");
const destination = ref("");
const dragged = ref(null);
const totalImages = computed(() => villas.value.reduce((sum, villa) => sum + villa.image_count, 0));
const proposedSlug = computed(() => slugifyVillaName(name.value));

async function load() {
  loading.value = true;
  try { villas.value = await listVillas(); }
  catch (error) { feedback.error("No se pudieron cargar las villas", error); }
  finally { loading.value = false; }
}

async function submit() {
  creating.value = true;
  try {
    const villa = await createVilla(name.value, destination.value);
    createOpen.value = false; name.value = ""; destination.value = "";
    feedback.notify("Villa creada");
    router.push(`/admin/experiencias/${villa.slug}`);
  } catch (error) { feedback.error("No se pudo crear la villa", error); }
  finally { creating.value = false; }
}

async function toggle(villa) {
  const previous = villa.is_active;
  villa.is_active = !previous;
  try { await setVillaActive(villa.id, villa.is_active); feedback.notify(villa.is_active ? "Villa publicada" : "Villa oculta"); }
  catch (error) { villa.is_active = previous; feedback.error("No se pudo cambiar el estado", error); }
}

async function remove(villa) {
  const result = await feedback.confirm({ title: `Eliminar ${villa.name}`, text: "Esta acción eliminará la villa y todas sus fotografías. No se puede deshacer.", confirmButtonText: "Eliminar definitivamente", cancelButtonText: "Cancelar", icon: "warning", confirmButtonColor: "#c62828" });
  if (!result.isConfirmed) return;
  try { await deleteVilla(villa); villas.value = villas.value.filter((item) => item.id !== villa.id); feedback.notify("Villa eliminada"); }
  catch (error) { feedback.error("No se pudo eliminar la villa", error); }
}

async function dropAt(index) {
  if (dragged.value === null || dragged.value === index) return;
  const previous = [...villas.value];
  const next = [...villas.value];
  const [item] = next.splice(dragged.value, 1); next.splice(index, 0, item);
  villas.value = next.map((villa, position) => ({ ...villa, sort_order: position + 1 })); dragged.value = null;
  try { await reorderVillas(villas.value); feedback.notify("Orden actualizado"); }
  catch (error) { villas.value = previous; feedback.error("No se pudo guardar el orden", error); }
}

onMounted(load);
</script>

<template>
  <main class="page-shell villas-page">
    <header class="page-header"><div><p class="eyebrow">Contenido web</p><h1>Experiencias</h1><p>Administra las villas y galerías que aparecerán en la página pública.</p></div><BaseButton @click="createOpen = true">+ Nueva Villa</BaseButton></header>
    <section class="summary"><span><strong>{{ villas.length }}</strong> propiedades</span><span><strong>{{ totalImages }}</strong> imágenes</span></section>
    <section v-if="loading" class="villa-grid"><article v-for="n in 6" :key="n" class="villa-card skeleton" /></section>
    <section v-else-if="villas.length" class="villa-grid">
      <article v-for="(villa,index) in villas" :key="villa.id" class="villa-card" draggable="true" @dragstart="dragged=index" @dragover.prevent @drop.prevent="dropAt(index)">
        <button class="cover" @click="router.push(`/admin/experiencias/${villa.slug}`)"><img v-if="villa.cover_url" :src="villa.cover_url" :alt="villa.name" loading="lazy"><span v-else>Sin portada</span></button>
        <div class="villa-body"><div class="title-row"><h2>{{ villa.name }}</h2><button class="drag" title="Arrastra para reordenar">↕</button></div><p>{{ villa.destination }}</p><p>{{ villa.image_count }} fotografías</p>
          <label class="switch"><input type="checkbox" :checked="villa.is_active" @change="toggle(villa)"><span>{{ villa.is_active ? "Publicada" : "Oculta" }}</span></label>
          <div class="actions"><button @click="router.push(`/admin/experiencias/${villa.slug}`)">Administrar →</button><button class="danger" @click="remove(villa)">Eliminar</button></div>
        </div>
      </article>
    </section>
    <section v-else class="empty"><strong>No hay villas todavía</strong><p>Crea la primera propiedad para comenzar.</p><BaseButton @click="createOpen=true">+ Nueva villa</BaseButton></section>
    <BaseModal :open="createOpen" title="Nueva villa" max-width="500px" hide-footer @close="createOpen=false">
      <form class="create-form" @submit.prevent="submit"><label><span>Nombre de la villa</span><input v-model.trim="name" maxlength="120" placeholder="Villa Caimán" required autofocus></label><label><span>Destino</span><input v-model.trim="destination" maxlength="120" placeholder="Tulum" required></label><p v-if="proposedSlug">Carpeta: <code>villas/{{ proposedSlug }}/</code></p><div><BaseButton variant="secondary" @click="createOpen=false">Cancelar</BaseButton><BaseButton type="submit" :disabled="creating || !proposedSlug || !destination">{{ creating ? "Creando…" : "Crear" }}</BaseButton></div></form>
    </BaseModal>
  </main>
</template>

<style scoped>
.villas-page{display:grid;gap:22px}.page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-header h1{margin:3px 0 5px;color:var(--text-strong);font-size:clamp(1.7rem,3vw,2.5rem)}.page-header p{margin:0;color:var(--text-muted)}.eyebrow{color:var(--primary)!important;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.summary{display:flex;gap:24px;padding:14px 18px;border:1px solid var(--border-color);border-radius:16px;background:var(--bg-surface);color:var(--text-muted)}.summary strong{color:var(--text-strong)}.villa-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.villa-card{overflow:hidden;border:1px solid var(--border-color);border-radius:22px;background:var(--bg-surface-solid);box-shadow:var(--shadow-sm)}.cover{display:grid;place-items:center;width:100%;height:220px;padding:0;background:var(--bg-muted);color:var(--text-faint);cursor:pointer}.cover img{width:100%;height:100%;object-fit:cover}.villa-body{display:grid;gap:9px;padding:17px}.title-row{display:flex;justify-content:space-between;gap:10px}.title-row h2{margin:0;font-size:1.08rem;color:var(--text-strong)}.drag{background:none;color:var(--text-faint);cursor:grab}.villa-body p{margin:0;color:var(--text-muted);font-size:.88rem}.switch{display:flex;align-items:center;gap:8px;width:max-content;font-weight:700;font-size:.85rem}.switch input{width:18px}.actions{display:flex;justify-content:space-between;border-top:1px solid var(--border-color);padding-top:12px}.actions button{padding:0;background:none;color:var(--primary);font-weight:800;cursor:pointer}.actions .danger{color:var(--danger)}.empty{display:grid;place-items:center;min-height:320px;padding:30px;border:1px dashed var(--border-strong);border-radius:22px;background:var(--bg-surface)}.empty p{color:var(--text-muted)}.skeleton{height:360px;background:linear-gradient(90deg,var(--bg-muted),var(--bg-soft),var(--bg-muted));background-size:200%;animation:pulse 1.2s infinite}@keyframes pulse{to{background-position:-200%}}.create-form,.create-form label{display:grid;gap:8px}.create-form{gap:18px}.create-form label span{font-weight:700}.create-form input{padding:12px}.create-form p{margin:0;color:var(--text-muted)}.create-form>div{display:flex;justify-content:flex-end;gap:10px}@media(max-width:1000px){.villa-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.page-header{align-items:stretch;flex-direction:column}.villa-grid{grid-template-columns:1fr}}
</style>
