<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import * as api from "@/services/whatsappApi";

const props = defineProps({
  section: {
    type: String,
    default: "summary",
  },
});

const route = useRoute();
const router = useRouter();
const perPageOptions = [10, 25, 50, 100];
const statuses = ["NUEVA", "PENDIENTE", "EN_ATENCION", "CERRADA", "CANCELADA"];
const dashboard = ref(null);
const loading = ref(false);
const error = ref("");
const rows = ref([]);
const meta = ref({});
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailError = ref("");
const selected = ref(null);
const messages = ref([]);
const relatedRequests = ref(null);
const statusSaving = ref(false);
let controller;

const sections = [
  { id: "summary", label: "Resumen", to: "/whatsapp" },
  { id: "conversations", label: "Conversaciones", to: "/whatsapp/conversaciones" },
  { id: "quotes", label: "Cotizaciones", to: "/whatsapp/cotizaciones" },
  { id: "parts", label: "Partes y refacciones", to: "/whatsapp/partes" },
  { id: "engines", label: "Motores", to: "/whatsapp/motores" },
  { id: "support", label: "Atención / soporte", to: "/whatsapp/soporte" },
  { id: "advisor", label: "Solicitudes de asesor", to: "/whatsapp/asesores" },
  { id: "history", label: "Historial", to: "/whatsapp/historial" },
];

const requestSections = {
  parts: {
    title: "Partes y refacciones",
    empty: "No hay solicitudes de partes registradas.",
    getList: api.getParts,
    getDetail: api.getPart,
    updateStatus: api.updatePartStatus,
    filters: ["search", "status", "condition", "date_from", "date_to"],
    columns: [
      ["id", "ID"],
      ["part_number", "P/N"],
      ["description", "Descripción"],
      ["quantity", "Cantidad"],
      ["condition", "Condición"],
      ["contact", "Contacto"],
      ["status", "Estado"],
      ["created_at", "Fecha"],
    ],
    detailFields: [
      ["id", "ID"],
      ["part_number", "P/N"],
      ["description", "Descripción"],
      ["quantity", "Cantidad"],
      ["condition", "Condición"],
      ["comments", "Comentarios"],
      ["status", "Estado"],
      ["conversation_id", "Conversación"],
      ["created_at", "Fecha"],
    ],
  },
  engines: {
    title: "Motores",
    empty: "No hay solicitudes de motores registradas.",
    getList: api.getEngines,
    getDetail: api.getEngine,
    updateStatus: api.updateEngineStatus,
    filters: ["search", "status", "condition", "service_type", "date_from", "date_to"],
    columns: [
      ["id", "ID"],
      ["engine_model", "Modelo"],
      ["part_number", "P/N"],
      ["serial_number", "S/N"],
      ["condition", "Condición"],
      ["service_type", "Tipo de solicitud"],
      ["contact", "Contacto"],
      ["status", "Estado"],
      ["created_at", "Fecha"],
    ],
    detailFields: [
      ["engine_model", "Modelo"],
      ["part_number", "P/N"],
      ["serial_number", "S/N"],
      ["condition", "Condición"],
      ["service_type", "Tipo de solicitud"],
      ["comments", "Comentarios"],
      ["status", "Estado"],
      ["conversation_id", "Conversación"],
      ["created_at", "Fecha"],
    ],
  },
  support: {
    title: "Atención / soporte",
    empty: "No hay solicitudes de soporte registradas.",
    getList: api.getSupport,
    getDetail: api.getSupportRequest,
    updateStatus: api.updateSupportStatus,
    filters: ["search", "status", "reason", "priority", "date_from", "date_to"],
    columns: [
      ["id", "ID"],
      ["reason", "Motivo"],
      ["reference", "Referencia"],
      ["priority", "Prioridad"],
      ["contact", "Contacto"],
      ["status", "Estado"],
      ["created_at", "Fecha"],
    ],
    detailFields: [
      ["reason", "Motivo"],
      ["reference", "Referencia"],
      ["description", "Descripción"],
      ["priority", "Prioridad"],
      ["comments", "Comentarios"],
      ["status", "Estado"],
      ["conversation_id", "Conversación"],
      ["created_at", "Fecha"],
    ],
  },
  advisor: {
    title: "Solicitudes de asesor",
    empty: "No hay solicitudes de asesor registradas.",
    getList: api.getAdvisorRequests,
    getDetail: api.getAdvisorRequest,
    updateStatus: api.updateAdvisorStatus,
    filters: ["search", "status", "reason", "transferred", "date_from", "date_to"],
    columns: [
      ["id", "ID"],
      ["reason", "Motivo"],
      ["reference", "Referencia"],
      ["contact", "Contacto"],
      ["status", "Estado"],
      ["transferred_at", "Transferido"],
      ["created_at", "Fecha"],
    ],
    detailFields: [
      ["reason", "Motivo"],
      ["reference", "Referencia"],
      ["comments", "Comentarios"],
      ["status", "Estado"],
      ["transferred_at", "Transferido"],
      ["conversation_id", "Conversación"],
      ["created_at", "Fecha"],
    ],
  },
};

const labels = {
  search: "Búsqueda",
  state: "Estado",
  active_section: "Sección activa",
  transferred_to_human: "Atención",
  status: "Estado",
  aircraft: "Aeronave",
  date: "Fecha",
  date_from: "Desde",
  date_to: "Hasta",
  condition: "Condición",
  service_type: "Tipo de solicitud",
  reason: "Motivo",
  priority: "Prioridad",
  transferred: "Transferido",
};

const filters = reactive({
  search: "",
  state: "",
  active_section: "",
  transferred_to_human: "",
  status: "",
  aircraft: "",
  date: "",
  date_from: "",
  date_to: "",
  condition: "",
  service_type: "",
  reason: "",
  priority: "",
  transferred: "",
  page: 1,
  per_page: 25,
});

const currentSection = computed(() => props.section || "summary");
const activeRequestConfig = computed(() => requestSections[currentSection.value]);
const pageTitle = computed(() => sections.find((section) => section.id === currentSection.value)?.label || "WhatsApp");
const pageDescription = computed(() => {
  if (currentSection.value === "summary") {
    return "Resumen operativo de conversaciones y solicitudes de WhatsApp.";
  }
  if (currentSection.value === "history") {
    return "Timeline administrativo de mensajes registrados por el backend.";
  }
  return "Consulta, filtra y gestiona datos reales del flujo de WhatsApp.";
});

const isHuman = (conversation) => Boolean(conversation?.transferred_to_human_at || conversation?.state === "TRANSFER_TO_HUMAN");
const hasRows = computed(() => rows.value.length > 0);

function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatValue(item, key) {
  if (key === "contact") {
    return item.contact?.name || item.contact?.phone_number || "—";
  }
  if (key.endsWith("_at") || key === "created_at" || key === "updated_at") {
    return formatDate(item[key]);
  }
  if (key === "estimated_price") {
    return item[key] ? `${item.currency || "USD"} ${Number(item[key]).toLocaleString("es-MX")}` : "—";
  }
  return item[key] ?? "—";
}

function cleanFilterPayload(extra = {}) {
  const payload = {
    ...extra,
    page: filters.page,
    per_page: filters.per_page,
  };
  for (const key of Object.keys(filters)) {
    if (!["page", "per_page"].includes(key) && filters[key] !== "") {
      payload[key] = filters[key];
    }
  }
  return payload;
}

function resetFilters() {
  Object.assign(filters, {
    search: "",
    state: "",
    active_section: "",
    transferred_to_human: "",
    status: "",
    aircraft: "",
    date: "",
    date_from: "",
    date_to: "",
    condition: "",
    service_type: "",
    reason: "",
    priority: "",
    transferred: "",
    page: 1,
    per_page: 25,
  });
}

function filterKeys() {
  if (currentSection.value === "conversations") {
    return ["search", "state", "active_section", "transferred_to_human", "date_from", "date_to"];
  }
  if (currentSection.value === "quotes") {
    return ["search", "status", "aircraft", "date", "date_from", "date_to"];
  }
  return activeRequestConfig.value?.filters || [];
}

async function loadDashboard(signal) {
  const result = await api.getDashboard({ signal });
  dashboard.value = result.data;
}

async function loadRows(signal) {
  let result;
  if (currentSection.value === "conversations") {
    result = await api.getConversations(cleanFilterPayload({ signal }));
  } else if (currentSection.value === "quotes") {
    result = await api.getFlightRequests(cleanFilterPayload({ signal }));
  } else if (currentSection.value === "history") {
    result = await api.getHistory({ page: filters.page, per_page: filters.per_page, signal });
  } else if (activeRequestConfig.value) {
    result = await activeRequestConfig.value.getList(cleanFilterPayload({ signal }));
  }

  rows.value = Array.isArray(result?.data) ? result.data : [];
  meta.value = result?.meta || {};
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  error.value = "";
  rows.value = [];
  meta.value = {};

  try {
    if (currentSection.value === "summary") {
      await loadDashboard(controller.signal);
    } else {
      await loadRows(controller.signal);
    }
  } catch (loadError) {
    if (!controller.signal.aborted) {
      error.value = loadError.message;
    }
  } finally {
    if (!controller.signal.aborted) {
      loading.value = false;
    }
  }
}

function applyFilters() {
  filters.page = 1;
  load();
}

function goToPage(page) {
  filters.page = page;
  load();
}

async function openConversation(item) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailError.value = "";
  selected.value = null;
  messages.value = [];
  relatedRequests.value = null;
  try {
    const result = await api.getConversation(item.id);
    selected.value = result.data;
    messages.value = result.messages || [];
    relatedRequests.value = result.related_requests || null;
  } catch (detailLoadError) {
    detailError.value = detailLoadError.message;
  } finally {
    detailLoading.value = false;
  }
}

async function openQuote(item) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailError.value = "";
  selected.value = null;
  messages.value = [];
  relatedRequests.value = null;
  try {
    const result = await api.getFlightRequest(item.id);
    selected.value = result.data;
  } catch (detailLoadError) {
    detailError.value = detailLoadError.message;
  } finally {
    detailLoading.value = false;
  }
}

async function openRequest(item) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailError.value = "";
  selected.value = null;
  messages.value = [];
  relatedRequests.value = null;
  try {
    const result = await activeRequestConfig.value.getDetail(item.id);
    selected.value = result.data;
  } catch (detailLoadError) {
    detailError.value = detailLoadError.message;
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  detailOpen.value = false;
  selected.value = null;
  messages.value = [];
  relatedRequests.value = null;
  detailError.value = "";
}

async function toggleHumanControl() {
  if (!selected.value) {
    return;
  }
  const human = isHuman(selected.value);
  const confirmed = window.confirm(human ? "¿Regresar esta conversación al bot?" : "¿Pasar esta conversación a asesor?");
  if (!confirmed) {
    return;
  }
  statusSaving.value = true;
  detailError.value = "";
  try {
    await (human ? api.returnToBot(selected.value.id) : api.transferToHuman(selected.value.id));
    const result = await api.getConversation(selected.value.id);
    selected.value = result.data;
    messages.value = result.messages || messages.value;
    await load();
  } catch (toggleError) {
    detailError.value = toggleError.message;
  } finally {
    statusSaving.value = false;
  }
}

async function changeStatus(status) {
  if (!selected.value || !activeRequestConfig.value || selected.value.status === status) {
    return;
  }
  if (!window.confirm(`¿Cambiar estado a ${status}?`)) {
    return;
  }
  statusSaving.value = true;
  detailError.value = "";
  try {
    const result = await activeRequestConfig.value.updateStatus(selected.value.id, status);
    selected.value = result.data;
    await load();
  } catch (statusError) {
    detailError.value = statusError.message;
  } finally {
    statusSaving.value = false;
  }
}

function openRow(item) {
  if (currentSection.value === "conversations") {
    openConversation(item);
  } else if (currentSection.value === "quotes") {
    openQuote(item);
  } else if (activeRequestConfig.value) {
    openRequest(item);
  }
}

watch(
  () => props.section,
  () => {
    resetFilters();
    closeDetail();
    load();
  },
);

onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <div class="whatsapp-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Admin WhatsApp</p>
        <h1>{{ pageTitle }}</h1>
        <p class="muted">{{ pageDescription }}</p>
      </div>
      <BaseButton variant="secondary" :disabled="loading" @click="load">
        {{ loading ? "Actualizando..." : "Actualizar" }}
      </BaseButton>
    </header>

    <nav class="section-tabs" aria-label="Secciones de WhatsApp">
      <button
        v-for="sectionItem in sections"
        :key="sectionItem.id"
        type="button"
        :class="{ active: currentSection === sectionItem.id }"
        @click="router.push(sectionItem.to)"
      >
        {{ sectionItem.label }}
      </button>
    </nav>

    <section v-if="currentSection === 'summary'" class="summary-grid" :aria-busy="loading">
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-else-if="loading" class="empty" role="status">Cargando resumen...</p>
      <template v-else-if="dashboard">
        <article class="metric-card">
          <span>Conversaciones</span>
          <strong>{{ dashboard.conversations?.total ?? 0 }}</strong>
          <p>{{ dashboard.conversations?.active ?? 0 }} activas · {{ dashboard.conversations?.human ?? 0 }} en humano</p>
        </article>
        <article class="metric-card">
          <span>Cotizaciones</span>
          <strong>{{ dashboard.flight_quotes?.total ?? 0 }}</strong>
          <p>Solicitudes de vuelo capturadas.</p>
        </article>
        <article class="metric-card">
          <span>Partes</span>
          <strong>{{ dashboard.parts?.total ?? 0 }}</strong>
          <p>{{ dashboard.parts?.new ?? 0 }} nuevas · {{ dashboard.parts?.in_progress ?? 0 }} en atención</p>
        </article>
        <article class="metric-card">
          <span>Motores</span>
          <strong>{{ dashboard.engines?.total ?? 0 }}</strong>
          <p>{{ dashboard.engines?.new ?? 0 }} nuevas · {{ dashboard.engines?.in_progress ?? 0 }} en atención</p>
        </article>
        <article class="metric-card">
          <span>Soporte</span>
          <strong>{{ dashboard.support?.total ?? 0 }}</strong>
          <p>{{ dashboard.support?.new ?? 0 }} nuevas · {{ dashboard.support?.in_progress ?? 0 }} en atención</p>
        </article>
        <article class="metric-card">
          <span>Solicitudes de asesor</span>
          <strong>{{ dashboard.advisor?.total ?? 0 }}</strong>
          <p>{{ dashboard.advisor?.new ?? 0 }} nuevas · {{ dashboard.advisor?.in_progress ?? 0 }} en atención</p>
        </article>
      </template>
      <p v-else class="empty">No hay datos de resumen disponibles.</p>
    </section>

    <template v-else>
      <form v-if="currentSection !== 'history'" class="filters" @submit.prevent="applyFilters">
        <label v-for="key in filterKeys()" :key="key">
          <span>{{ labels[key] }}</span>
          <select v-if="key === 'status'" v-model="filters[key]">
            <option value="">Todos</option>
            <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
          </select>
          <select v-else-if="key === 'transferred_to_human'" v-model="filters[key]">
            <option value="">Todos</option>
            <option value="0">Bot</option>
            <option value="1">Humano</option>
          </select>
          <select v-else-if="key === 'transferred'" v-model="filters[key]">
            <option value="">Todos</option>
            <option value="1">Transferido</option>
          </select>
          <input v-else-if="key.startsWith('date')" v-model="filters[key]" type="date">
          <input v-else v-model.trim="filters[key]" type="search" :placeholder="labels[key]">
        </label>
        <label>
          <span>Por página</span>
          <select v-model.number="filters.per_page">
            <option v-for="amount in perPageOptions" :key="amount" :value="amount">{{ amount }}</option>
          </select>
        </label>
        <div class="filter-actions">
          <BaseButton type="submit" :disabled="loading">Filtrar</BaseButton>
          <BaseButton variant="secondary" :disabled="loading" @click="resetFilters(); load()">Limpiar</BaseButton>
        </div>
      </form>

      <section class="table-card" :aria-busy="loading">
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-else-if="loading" class="empty" role="status">Cargando registros...</p>
        <p v-else-if="!hasRows" class="empty">
          {{
            currentSection === "conversations"
              ? "No hay conversaciones con estos filtros."
              : currentSection === "quotes"
                ? "No hay cotizaciones de WhatsApp registradas."
                : currentSection === "history"
                  ? "No hay historial administrativo registrado."
                  : activeRequestConfig.empty
          }}
        </p>
        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr v-if="currentSection === 'conversations'">
                <th>Contacto</th><th>Teléfono</th><th>Sección activa</th><th>Estado</th><th>Último mensaje</th><th>Última actividad</th><th>Atención</th><th>Acciones</th>
              </tr>
              <tr v-else-if="currentSection === 'quotes'">
                <th>ID</th><th>Cliente</th><th>Ruta</th><th>Pasajeros</th><th>Aeronave</th><th>Precio aproximado</th><th>Estado</th><th>Fecha</th><th>Ver</th>
              </tr>
              <tr v-else-if="currentSection === 'history'">
                <th>Tipo</th><th>Contacto</th><th>Dirección</th><th>Mensaje</th><th>Estado</th><th>Fecha</th>
              </tr>
              <tr v-else>
                <th v-for="[, label] in activeRequestConfig.columns" :key="label">{{ label }}</th><th>Ver</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in rows" :key="item.id">
                <template v-if="currentSection === 'conversations'">
                  <td>{{ item.contact?.name || "—" }}</td>
                  <td>{{ item.contact?.phone_number || "—" }}</td>
                  <td>{{ item.active_section || "—" }}</td>
                  <td>{{ item.state || "—" }}</td>
                  <td class="truncate">{{ item.last_message?.body || "—" }}</td>
                  <td>{{ formatDate(item.last_message_at) }}</td>
                  <td><span class="badge" :class="{ human: isHuman(item) }">{{ isHuman(item) ? "Humano" : "Bot" }}</span></td>
                  <td><button class="link-button" type="button" @click="openRow(item)">Ver</button></td>
                </template>
                <template v-else-if="currentSection === 'quotes'">
                  <td>{{ item.id }}</td>
                  <td>{{ item.client_name || item.contact?.name || item.contact?.phone_number || "—" }}</td>
                  <td>{{ item.route || "—" }}</td>
                  <td>{{ item.passengers ?? "—" }}</td>
                  <td>{{ item.aircraft_name || item.selected_aircraft || "—" }}</td>
                  <td>{{ formatValue(item, "estimated_price") }}</td>
                  <td><span class="badge">{{ item.status || "—" }}</span></td>
                  <td>{{ formatDate(item.created_at) }}</td>
                  <td><button class="link-button" type="button" @click="openRow(item)">Ver</button></td>
                </template>
                <template v-else-if="currentSection === 'history'">
                  <td>{{ item.type }}</td>
                  <td>{{ item.contact?.name || item.contact?.phone_number || "—" }}</td>
                  <td>{{ item.direction || "—" }}</td>
                  <td class="truncate">{{ item.body || "—" }}</td>
                  <td>{{ item.status || "—" }}</td>
                  <td>{{ formatDate(item.created_at) }}</td>
                </template>
                <template v-else>
                  <td v-for="[key] in activeRequestConfig.columns" :key="key">
                    <span v-if="key === 'status'" class="badge">{{ item.status }}</span>
                    <span v-else>{{ formatValue(item, key) }}</span>
                  </td>
                  <td><button class="link-button" type="button" @click="openRow(item)">Ver</button></td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <footer v-if="meta.total" class="pagination">
          <span>Página {{ meta.current_page || filters.page }} de {{ meta.last_page || 1 }} · {{ meta.total }} registros</span>
          <div>
            <BaseButton variant="secondary" :disabled="loading || (meta.current_page || filters.page) <= 1" @click="goToPage((meta.current_page || filters.page) - 1)">Anterior</BaseButton>
            <BaseButton variant="secondary" :disabled="loading || (meta.current_page || filters.page) >= (meta.last_page || 1)" @click="goToPage((meta.current_page || filters.page) + 1)">Siguiente</BaseButton>
          </div>
        </footer>
      </section>
    </template>

    <div v-if="detailOpen" class="drawer-overlay" @click.self="closeDetail">
      <aside class="drawer" aria-live="polite">
        <header class="drawer-head">
          <div>
            <p class="eyebrow">Detalle</p>
            <h2>{{ currentSection === "conversations" ? "Conversación" : currentSection === "quotes" ? "Cotización" : activeRequestConfig?.title }}</h2>
          </div>
          <button type="button" class="close-button" @click="closeDetail">Cerrar</button>
        </header>

        <p v-if="detailLoading" class="empty">Cargando detalle...</p>
        <p v-else-if="detailError" class="error" role="alert">{{ detailError }}</p>
        <template v-else-if="selected">
          <section v-if="currentSection === 'conversations'" class="detail-grid">
            <span>Contacto</span><strong>{{ selected.contact?.name || "—" }}</strong>
            <span>Teléfono</span><strong>{{ selected.contact?.phone_number || "—" }}</strong>
            <span>Conversation ID</span><strong>{{ selected.id }}</strong>
            <span>Estado</span><strong>{{ selected.state || "—" }}</strong>
            <span>Sección activa</span><strong>{{ selected.active_section || "—" }}</strong>
            <span>Atención</span><strong>{{ isHuman(selected) ? "Humano" : "Bot" }}</strong>
            <span>Creación</span><strong>{{ formatDate(selected.created_at) }}</strong>
            <span>Última actividad</span><strong>{{ formatDate(selected.last_message_at) }}</strong>
          </section>

          <section v-else-if="currentSection === 'quotes'" class="detail-grid">
            <span>ID</span><strong>{{ selected.id }}</strong>
            <span>Cliente</span><strong>{{ selected.client_name || selected.contact?.name || "—" }}</strong>
            <span>Ruta</span><strong>{{ selected.route || "—" }}</strong>
            <span>Pasajeros</span><strong>{{ selected.passengers ?? "—" }}</strong>
            <span>Aeronave</span><strong>{{ selected.aircraft_name || selected.selected_aircraft || "—" }}</strong>
            <span>Precio aproximado</span><strong>{{ formatValue(selected, "estimated_price") }}</strong>
            <span>Estado</span><strong>{{ selected.status || "—" }}</strong>
            <span>Fecha</span><strong>{{ formatDate(selected.created_at) }}</strong>
          </section>

          <section v-else class="detail-grid">
            <template v-for="[key, label] in activeRequestConfig.detailFields" :key="key">
              <span>{{ label }}</span><strong>{{ formatValue(selected, key) }}</strong>
            </template>
            <span>Contacto</span><strong>{{ selected.contact?.name || selected.contact?.phone_number || "—" }}</strong>
          </section>

          <div v-if="currentSection === 'conversations'" class="drawer-actions">
            <BaseButton :disabled="statusSaving" @click="toggleHumanControl">
              {{ statusSaving ? "Guardando..." : isHuman(selected) ? "Regresar al bot" : "Pasar a asesor" }}
            </BaseButton>
          </div>

          <label v-if="activeRequestConfig" class="status-select">
            <span>Cambiar status</span>
            <select :value="selected.status" :disabled="statusSaving" @change="changeStatus($event.target.value)">
              <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
            </select>
          </label>

          <section v-if="relatedRequests" class="related">
            <h3>Solicitudes relacionadas</h3>
            <p v-for="(items, key) in relatedRequests" :key="key">{{ key }}: {{ items.length }}</p>
          </section>

          <section v-if="messages.length" class="timeline">
            <h3>Mensajes</h3>
            <article v-for="message in messages" :key="message.id" class="message" :class="{ outbound: message.direction === 'outbound' }">
              <span>{{ message.direction === "outbound" ? "Sky Group" : "Cliente" }}</span>
              <p>{{ message.body || `Mensaje de tipo ${message.type}` }}</p>
              <time>{{ formatDate(message.created_at || message.sent_at) }}</time>
            </article>
          </section>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.whatsapp-page { display: flex; flex-direction: column; gap: 18px; color: var(--text-main); }
.page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h1 { margin: 4px 0; font-size: 1.8rem; color: var(--text-strong); }
h2, h3 { margin: 0; color: var(--text-strong); }
.eyebrow { color: var(--primary); text-transform: uppercase; font-size: .72rem; font-weight: 800; letter-spacing: .12em; margin: 0; }
.muted { color: var(--text-muted); font-size: .86rem; margin: 6px 0 0; }
.section-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-surface-solid); }
.section-tabs button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: .82rem; font-weight: 750; }
.section-tabs button.active { color: var(--primary); background: var(--primary-soft); }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.metric-card, .table-card, .filters { border: 1px solid var(--border-color); border-radius: 16px; background: var(--bg-surface-solid); box-shadow: var(--shadow-sm); }
.metric-card { padding: 18px; }
.metric-card span { color: var(--text-muted); font-weight: 800; font-size: .78rem; text-transform: uppercase; }
.metric-card strong { display: block; margin: 10px 0; color: var(--text-strong); font-size: 2rem; }
.metric-card p { margin: 0; color: var(--text-muted); font-size: .86rem; }
.filters { display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 12px; padding: 14px; }
.filters label, .status-select { display: flex; flex-direction: column; gap: 7px; font-size: .78rem; font-weight: 800; color: var(--text-muted); }
input, select { width: 100%; border: 1px solid var(--border-strong); background: var(--bg-soft); border-radius: 12px; padding: 11px; color: var(--text-main); font: inherit; font-size: .86rem; }
.filter-actions { display: flex; gap: 8px; align-items: end; }
.table-card { overflow: hidden; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 980px; }
th, td { padding: 13px 14px; border-bottom: 1px solid var(--border-color); text-align: left; vertical-align: middle; font-size: .84rem; }
th { color: var(--text-muted); font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; background: var(--bg-soft); }
.truncate { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); font-size: .72rem; font-weight: 800; }
.badge.human { color: var(--warning); background: rgba(245, 158, 11, .12); }
.link-button, .close-button { border: 0; background: transparent; color: var(--primary); font: inherit; font-weight: 800; cursor: pointer; }
.pagination { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px; color: var(--text-muted); font-size: .84rem; }
.pagination div { display: flex; gap: 8px; }
.empty, .error { margin: 0; padding: 24px; text-align: center; color: var(--text-muted); }
.error { color: var(--danger); background: rgba(220, 38, 38, .06); text-align: left; }
.drawer-overlay { position: fixed; inset: 0; z-index: 80; display: flex; justify-content: flex-end; background: rgba(15, 23, 42, .38); }
.drawer { width: min(760px, 100%); height: 100%; overflow-y: auto; padding: 22px; background: var(--bg-surface-solid); box-shadow: -20px 0 40px rgba(15, 23, 42, .18); }
.drawer-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
.detail-grid { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 10px 14px; padding: 18px 0; }
.detail-grid span { color: var(--text-muted); font-size: .78rem; font-weight: 800; }
.detail-grid strong { overflow-wrap: anywhere; font-size: .9rem; }
.drawer-actions, .status-select, .related, .timeline { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color); }
.related p { margin: 8px 0 0; color: var(--text-muted); }
.timeline { display: flex; flex-direction: column; gap: 12px; }
.message { max-width: 86%; padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 14px 14px 14px 4px; background: var(--bg-soft); }
.message.outbound { align-self: flex-end; border-radius: 14px 14px 4px 14px; background: var(--primary-soft); }
.message span { color: var(--primary); font-size: .72rem; font-weight: 800; }
.message p { margin: 8px 0; white-space: pre-wrap; line-height: 1.5; }
.message time { color: var(--text-muted); font-size: .72rem; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
@media (max-width: 1180px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 700px) { .summary-grid, .filters { grid-template-columns: 1fr; } .filter-actions, .pagination { flex-direction: column; align-items: stretch; } .detail-grid { grid-template-columns: 1fr; } .message { max-width: 96%; } }
</style>
