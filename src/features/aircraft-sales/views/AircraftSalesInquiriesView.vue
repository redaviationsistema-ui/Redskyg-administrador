<script setup>
import { onMounted, ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import { useFeedback } from "@/composables/useFeedback";
import { deleteInquiry, inquiryStatusLabels, INQUIRY_STATUSES, listAircraftInquiries, updateInquiryStatus } from "../services/aircraftSales.service";

const feedback = useFeedback();
const inquiries = ref([]);
const loading = ref(false);
const status = ref("");
const selected = ref(null);
const saving = ref(false);
const setupError = ref("");

function date(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function money(value, currency = "USD") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

async function load() {
  loading.value = true;
  setupError.value = "";
  try { inquiries.value = await listAircraftInquiries(status.value); }
  catch (error) {
    inquiries.value = [];
    if (error.code === "AIRCRAFT_SALES_INQUIRIES_MISSING") {
      setupError.value = "Supabase no encuentra aircraft_sales_inquiries. Ejecuta database/aircraft_sales_schema.sql y despues notify pgrst, 'reload schema';";
      return;
    }
    feedback.error("No se pudieron cargar las solicitudes", error);
  }
  finally { loading.value = false; }
}

async function changeStatus(nextStatus) {
  if (!selected.value) return;
  saving.value = true;
  try {
    selected.value = await updateInquiryStatus(selected.value.id, nextStatus);
    await load();
    feedback.notify("Solicitud actualizada");
  } catch (error) { feedback.error("No se pudo actualizar la solicitud", error); }
  finally { saving.value = false; }
}

async function remove(item) {
  const result = await feedback.confirm({ title: "Eliminar solicitud", text: "Esta accion no se puede deshacer.", confirmButtonText: "Eliminar", cancelButtonText: "Cancelar", icon: "warning", confirmButtonColor: "#c62828" });
  if (!result.isConfirmed) return;
  try { await deleteInquiry(item.id); inquiries.value = inquiries.value.filter((row) => row.id !== item.id); if (selected.value?.id === item.id) selected.value = null; feedback.notify("Solicitud eliminada"); }
  catch (error) { feedback.error("No se pudo eliminar la solicitud", error); }
}

onMounted(load);
</script>

<template>
  <main class="page-shell inquiries-page">
    <header class="page-header"><div><p class="eyebrow">Aircraft Sales</p><h1>Solicitudes de informacion</h1><p>Seguimiento de prospectos interesados en aeronaves.</p></div></header>
    <form class="filters" @submit.prevent="load"><select v-model="status"><option value="">Todos los estados</option><option v-for="item in INQUIRY_STATUSES" :key="item" :value="item">{{ inquiryStatusLabels[item] }}</option></select><BaseButton type="submit" :disabled="loading">Filtrar</BaseButton></form>
    <section class="table-card">
      <p v-if="loading" class="empty">Cargando solicitudes...</p>
      <p v-else-if="setupError" class="setup-error">{{ setupError }}</p>
      <p v-else-if="!inquiries.length" class="empty">No hay solicitudes registradas.</p>
      <div v-else class="table-scroll"><table><thead><tr><th>Aeronave</th><th>Cliente</th><th>Correo</th><th>Telefono</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody><tr v-for="item in inquiries" :key="item.id"><td><strong>{{ item.aircraft_sales?.name || "-" }}</strong><small>{{ item.aircraft_sales?.registration || "-" }}</small></td><td>{{ item.name || "-" }}</td><td>{{ item.email || "-" }}</td><td>{{ item.phone || "-" }}</td><td>{{ date(item.created_at) }}</td><td><span class="badge">{{ inquiryStatusLabels[item.status] || item.status }}</span></td><td><button class="link-button" @click="selected=item">Ver</button><button class="danger-link" @click="remove(item)">Eliminar</button></td></tr></tbody></table></div>
    </section>
    <BaseModal :open="Boolean(selected)" title="Detalle de solicitud" max-width="760px" @close="selected=null">
      <section v-if="selected" class="detail">
        <div><span>Aeronave</span><strong>{{ selected.aircraft_sales?.name || "-" }}</strong><p>{{ selected.aircraft_sales?.registration || "-" }} · {{ money(selected.aircraft_sales?.price, selected.aircraft_sales?.currency) }}</p></div>
        <div><span>Solicitante</span><strong>{{ selected.name || "-" }}</strong><p>{{ selected.email || "-" }} · {{ selected.phone || "-" }}</p></div>
        <div class="wide"><span>Mensaje</span><p>{{ selected.message || "-" }}</p></div>
        <label><span>Estado</span><select :value="selected.status" :disabled="saving" @change="changeStatus($event.target.value)"><option v-for="item in INQUIRY_STATUSES" :key="item" :value="item">{{ inquiryStatusLabels[item] }}</option></select></label>
      </section>
    </BaseModal>
  </main>
</template>

<style scoped>
.inquiries-page{display:grid;gap:20px}.page-header h1{margin:3px 0 5px;color:var(--text-strong);font-size:clamp(1.7rem,3vw,2.5rem)}.page-header p{margin:0;color:var(--text-muted)}.eyebrow{color:var(--primary)!important;font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.filters{display:flex;gap:10px;align-items:center;padding:14px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface-solid)}select{border:1px solid var(--border-strong);border-radius:8px;background:var(--bg-soft);padding:10px;color:var(--text-main);font:inherit}.table-card{overflow:hidden;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface-solid);box-shadow:var(--shadow-sm)}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;min-width:900px}th,td{padding:13px 14px;border-bottom:1px solid var(--border-color);text-align:left;font-size:.86rem;vertical-align:middle}th{color:var(--text-muted);font-size:.72rem;text-transform:uppercase;background:var(--bg-soft)}td small{display:block;color:var(--text-muted);margin-top:3px}.badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:.72rem;font-weight:800}.link-button,.danger-link{border:0;background:transparent;color:var(--primary);font-weight:800;cursor:pointer}.danger-link{margin-left:10px;color:var(--danger)}.empty,.setup-error{margin:0;padding:28px;text-align:center;color:var(--text-muted)}.setup-error{color:var(--danger);background:rgba(220,38,38,.06);text-align:left}.detail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.detail span{display:block;color:var(--text-muted);font-size:.78rem;font-weight:800}.detail strong{display:block;margin-top:5px;color:var(--text-strong)}.detail p{margin:6px 0 0;color:var(--text-muted);white-space:pre-wrap}.detail .wide{grid-column:1/-1}.detail label{display:grid;gap:7px}@media(max-width:640px){.detail{grid-template-columns:1fr}}
</style>
