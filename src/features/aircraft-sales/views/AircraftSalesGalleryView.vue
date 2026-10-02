<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import { useFeedback } from "@/composables/useFeedback";
import {
  aircraftStatusLabels,
  buildAircraftSaleSlug,
  createAircraft,
  deleteAircraft,
  listAircraft,
  reorderAircraft,
  setAircraftActive,
} from "../services/aircraftSales.service";

const router = useRouter();
const feedback = useFeedback();
const aircraft = ref([]);
const loading = ref(true);
const creating = ref(false);
const createOpen = ref(false);
const dragged = ref(null);
const filters = reactive({ status: "", search: "", document: "" });
const form = reactive({ name: "", manufacturer: "", model: "", registration: "", price: null, currency: "USD", status: "ready_to_operate" });

const proposedSlug = computed(() => buildAircraftSaleSlug(form.name, form.registration));
const filteredAircraft = computed(() => {
  if (filters.document === "with_pdf") return aircraft.value.filter((item) => Boolean(item.pdf_path));
  if (filters.document === "without_pdf") return aircraft.value.filter((item) => !item.pdf_path);
  return aircraft.value;
});
const grouped = computed(() => ({
  ready_to_operate: filteredAircraft.value.filter((item) => item.status === "ready_to_operate"),
  out_of_service: filteredAircraft.value.filter((item) => item.status === "out_of_service"),
}));

function money(value, currency = "USD") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

async function load() {
  loading.value = true;
  try { aircraft.value = await listAircraft(filters); }
  catch (error) { feedback.error("No se pudo cargar el catalogo", error); }
  finally { loading.value = false; }
}

async function submit() {
  creating.value = true;
  try {
    const created = await createAircraft({
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim() || null,
      model: form.model.trim() || null,
      registration: form.registration.trim().toUpperCase(),
      price: form.price ? Number(form.price) : null,
      currency: form.currency || "USD",
      status: form.status,
      description: null,
      is_active: false,
    });
    Object.assign(form, { name: "", manufacturer: "", model: "", registration: "", price: null, currency: "USD", status: "ready_to_operate" });
    createOpen.value = false;
    feedback.notify("Aeronave creada");
    router.push(`/admin/aircraft-sales/${created.slug}`);
  } catch (error) { feedback.error("No se pudo crear la aeronave", error); }
  finally { creating.value = false; }
}

async function toggle(item) {
  const previous = item.is_active;
  item.is_active = !previous;
  try { await setAircraftActive(item.id, item.is_active); feedback.notify(item.is_active ? "Aeronave publicada" : "Aeronave oculta"); }
  catch (error) { item.is_active = previous; feedback.error("No se pudo cambiar el estado", error); }
}

async function remove(item) {
  const result = await feedback.confirm({ title: `Eliminar ${item.name}`, text: "Esta accion eliminara la aeronave y todas sus imagenes.", confirmButtonText: "Eliminar definitivamente", cancelButtonText: "Cancelar", icon: "warning", confirmButtonColor: "#c62828" });
  if (!result.isConfirmed) return;
  try { await deleteAircraft(item); aircraft.value = aircraft.value.filter((row) => row.id !== item.id); feedback.notify("Aeronave eliminada"); }
  catch (error) { feedback.error("No se pudo eliminar la aeronave", error); }
}

async function dropAt(index) {
  if (dragged.value === null || dragged.value === index) return;
  const previous = [...aircraft.value];
  const next = [...aircraft.value];
  const [item] = next.splice(dragged.value, 1);
  next.splice(index, 0, item);
  aircraft.value = next.map((row, position) => ({ ...row, display_order: position + 1 }));
  dragged.value = null;
  try { await reorderAircraft(aircraft.value); feedback.notify("Orden actualizado"); }
  catch (error) { aircraft.value = previous; feedback.error("No se pudo guardar el orden", error); }
}

onMounted(load);
</script>

<template>
  <main class="page-shell sales-page">
    <header class="page-header">
      <div><p class="eyebrow">Gestion de aeronaves</p><h1>Aircraft Sales</h1><p>Administra aeronaves en venta, galeria, publicacion y orden.</p></div>
      <div class="header-actions">
        <BaseButton variant="secondary" @click="router.push('/admin/aircraft-sales/inquiries')">Solicitudes</BaseButton>
        <BaseButton @click="createOpen = true">+ Agregar aeronave</BaseButton>
      </div>
    </header>

    <form class="filters" @submit.prevent="load">
      <select v-model="filters.status"><option value="">Todos</option><option value="ready_to_operate">Listos para operar</option><option value="out_of_service">Fuera de servicio</option></select>
      <select v-model="filters.document"><option value="">Todos los documentos</option><option value="with_pdf">Con PDF</option><option value="without_pdf">Sin PDF</option></select>
      <input v-model.trim="filters.search" type="search" placeholder="Buscar por nombre, modelo o matricula">
      <BaseButton type="submit" :disabled="loading">Filtrar</BaseButton>
    </form>

    <section v-if="loading" class="aircraft-grid"><article v-for="n in 6" :key="n" class="aircraft-card skeleton" /></section>
    <template v-else-if="filteredAircraft.length">
      <section v-for="status in ['ready_to_operate','out_of_service']" :key="status" class="status-section">
        <h2>{{ aircraftStatusLabels[status] }}</h2>
        <div v-if="grouped[status].length" class="aircraft-grid">
          <article v-for="(item,index) in grouped[status]" :key="item.id" class="aircraft-card" draggable="true" @dragstart="dragged=index" @dragover.prevent @drop.prevent="dropAt(index)">
            <button class="cover" @click="router.push(`/admin/aircraft-sales/${item.slug}`)">
              <img v-if="item.cover_url" :src="item.cover_url" :alt="item.name" loading="lazy"><span v-else>Sin imagenes</span>
            </button>
            <div class="card-body">
              <div class="title-row"><h3>{{ item.name }}</h3><button class="drag" title="Arrastra para reordenar">↕</button></div>
              <p>{{ item.registration }} · {{ item.model || item.manufacturer || "Sin modelo" }}</p>
              <strong>{{ money(item.price, item.currency) }}</strong>
              <p>{{ item.image_count }} imagenes</p>
              <span class="document-badge" :class="{ missing: !item.pdf_path }">{{ item.pdf_path ? "PDF cargado" : "Sin PDF" }}</span>
              <label class="switch"><input type="checkbox" :checked="item.is_active" @change="toggle(item)"><span>{{ item.is_active ? "Publicado" : "Oculto" }}</span></label>
              <div class="actions"><button @click="router.push(`/admin/aircraft-sales/${item.slug}`)">Editar</button><button class="danger" @click="remove(item)">Eliminar</button></div>
            </div>
          </article>
        </div>
        <p v-else class="empty-line">Sin aeronaves en esta categoria.</p>
      </section>
    </template>
    <section v-else class="empty"><strong>No hay aeronaves todavia</strong><p>Crea la primera aeronave para comenzar.</p><BaseButton @click="createOpen = true">+ Agregar aeronave</BaseButton></section>

    <BaseModal :open="createOpen" title="Nueva aeronave" max-width="640px" hide-footer @close="createOpen=false">
      <form class="create-form" @submit.prevent="submit">
        <label><span>Nombre *</span><input v-model.trim="form.name" maxlength="140" placeholder="Learjet 35A" required autofocus></label>
        <label><span>Matricula *</span><input v-model.trim="form.registration" maxlength="30" placeholder="XB-RSG" required></label>
        <label><span>Fabricante</span><input v-model.trim="form.manufacturer" maxlength="120" placeholder="Bombardier"></label>
        <label><span>Modelo</span><input v-model.trim="form.model" maxlength="120" placeholder="Learjet 35A"></label>
        <label><span>Precio</span><input v-model.number="form.price" type="number" min="0" step="1" placeholder="1850000"></label>
        <label><span>Estado</span><select v-model="form.status"><option value="ready_to_operate">Listo para operar</option><option value="out_of_service">Fuera de servicio</option></select></label>
        <p v-if="proposedSlug">URL: <code>/admin/aircraft-sales/{{ proposedSlug }}</code></p>
        <div><BaseButton variant="secondary" @click="createOpen=false">Cancelar</BaseButton><BaseButton type="submit" :disabled="creating || !proposedSlug">{{ creating ? "Creando..." : "Crear" }}</BaseButton></div>
      </form>
    </BaseModal>
  </main>
</template>

<style scoped>
.sales-page{display:grid;gap:22px}.page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-header h1{margin:3px 0 5px;color:var(--text-strong);font-size:clamp(1.7rem,3vw,2.5rem)}.page-header p{margin:0;color:var(--text-muted)}.eyebrow{color:var(--primary)!important;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.header-actions,.filters{display:flex;gap:10px;flex-wrap:wrap}.filters{align-items:center;padding:14px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface-solid)}.filters input,.filters select,.create-form input,.create-form select,.create-form textarea{min-height:42px;border:1px solid var(--border-strong);border-radius:8px;background:var(--bg-soft);padding:10px;color:var(--text-main);font:inherit}.filters input{min-width:min(340px,100%)}.status-section{display:grid;gap:14px}.status-section h2{margin:0;color:var(--text-strong);font-size:1.1rem}.aircraft-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.aircraft-card{overflow:hidden;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface-solid);box-shadow:var(--shadow-sm)}.cover{display:grid;place-items:center;width:100%;height:210px;padding:0;background:var(--bg-muted);color:var(--text-faint);cursor:pointer}.cover img{width:100%;height:100%;object-fit:cover}.card-body{display:grid;gap:8px;padding:16px}.title-row{display:flex;justify-content:space-between;gap:10px}.title-row h3{margin:0;font-size:1rem;color:var(--text-strong)}.drag{background:none;color:var(--text-faint);cursor:grab}.card-body p{margin:0;color:var(--text-muted);font-size:.86rem}.card-body strong{color:var(--text-strong)}.switch{display:flex;align-items:center;gap:8px;width:max-content;font-weight:700;font-size:.84rem}.switch input{width:18px}.actions{display:flex;justify-content:space-between;border-top:1px solid var(--border-color);padding-top:12px}.actions button{padding:0;background:none;color:var(--primary);font-weight:800;cursor:pointer}.actions .danger{color:var(--danger)}.empty,.empty-line{padding:24px;border:1px dashed var(--border-strong);border-radius:8px;background:var(--bg-surface);color:var(--text-muted);text-align:center}.skeleton{height:350px;background:linear-gradient(90deg,var(--bg-muted),var(--bg-soft),var(--bg-muted));background-size:200%;animation:pulse 1.2s infinite}@keyframes pulse{to{background-position:-200%}}.create-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.create-form label{display:grid;gap:7px;font-weight:700}.create-form p,.create-form>div{grid-column:1/-1}.create-form>div{display:flex;justify-content:flex-end;gap:10px}@media(max-width:1100px){.aircraft-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.page-header{align-items:stretch;flex-direction:column}.aircraft-grid,.create-form{grid-template-columns:1fr}}
.document-badge{display:inline-flex;width:max-content;padding:4px 8px;border-radius:999px;background:rgba(22,163,74,.12);color:var(--success);font-size:.72rem;font-weight:800}.document-badge.missing{background:rgba(217,119,6,.12);color:#b45309}
</style>
