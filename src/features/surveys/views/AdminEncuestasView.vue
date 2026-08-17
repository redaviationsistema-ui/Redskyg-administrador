<script setup>
import { computed, onMounted, ref, watch } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import BaseTable from "@/components/ui/BaseTable.vue";
import StatCard from "@/components/ui/StatCard.vue";
import { useFeedback } from "@/composables/useFeedback";
import { usePagination } from "@/composables/usePagination";
import {
  deleteSurveyResponse,
  fetchSurveyResponses,
  SURVEY_SOURCE_LABELS,
  SURVEY_SOURCE_OPTIONS,
  SURVEY_STATUS_OPTIONS,
  updateSurveyResponse,
} from "@/features/surveys/services/surveys.service";

const feedback = useFeedback();

const surveys = ref([]);
const loading = ref(false);
const selectedSurveyId = ref(null);
const searchTerm = ref("");
const statusFilter = ref("all");
const sourceFilter = ref("all");
const selectedStatus = ref("nuevo");
const notesDraft = ref("");
const editMode = ref(false);
const editForm = ref({
  lead_name: "",
  lead_contact: "",
  status: "nuevo",
  notes: "",
});
const savingStatus = ref(false);
const savingNotes = ref(false);
const savingEdit = ref(false);
const deleting = ref(false);

const filteredSurveys = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();

  return surveys.value.filter((survey) => {
    const matchesStatus =
      statusFilter.value === "all" || survey.status === statusFilter.value;
    const matchesSource =
      sourceFilter.value === "all" || survey.source === sourceFilter.value;

    if (!matchesStatus || !matchesSource) {
      return false;
    }

    if (!term) {
      return true;
    }

    const haystack = [
      survey.lead_name,
      survey.lead_contact,
      survey.q6,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
});

const metrics = computed(() => ({
  total: surveys.value.length,
  nuevas: surveys.value.filter((item) => item.status === "nuevo").length,
  revisadas: surveys.value.filter((item) => item.status === "revisado").length,
  contactadas: surveys.value.filter((item) => item.status === "contactado").length,
  descartadas: surveys.value.filter((item) => item.status === "descartado").length,
}));

const selectedSurvey = computed(() =>
  surveys.value.find((item) => item.id === selectedSurveyId.value) || null,
);

const { currentPage, totalPages, paginatedItems, nextPage, prevPage } =
  usePagination(filteredSurveys, 10);

watch([searchTerm, statusFilter, sourceFilter], () => {
  currentPage.value = 1;
});

watch(selectedSurvey, (survey) => {
  if (!survey) {
    editMode.value = false;
    return;
  }

  selectedStatus.value = normalizeStatus(survey.status);
  notesDraft.value = survey.notes || "";
  editForm.value = {
    lead_name: survey.lead_name || "",
    lead_contact: survey.lead_contact || "",
    status: normalizeStatus(survey.status),
    notes: survey.notes || "",
  };
});

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SURVEY_STATUS_OPTIONS.some((item) => item.value === normalized)
    ? normalized
    : "nuevo";
}

function getStatusLabel(value) {
  return (
    SURVEY_STATUS_OPTIONS.find((item) => item.value === normalizeStatus(value))?.label ||
    "Nuevo"
  );
}

function getSourceLabel(value) {
  return SURVEY_SOURCE_LABELS[value] || String(value || "Directo");
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLeadName(value) {
  return value?.trim() || "Anónimo";
}

function formatLeadContact(value) {
  return value?.trim() || "No proporcionado";
}

function normalizeToList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => String(item || "").trim() !== "");
  }

  if (typeof value === "string") {
    return value
      .split(/,|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function applySurveyUpdate(updatedSurvey) {
  surveys.value = surveys.value.map((item) =>
    item.id === updatedSurvey.id ? { ...item, ...updatedSurvey } : item,
  );
}

async function loadSurveys() {
  loading.value = true;

  try {
    surveys.value = await fetchSurveyResponses();
  } catch (error) {
    console.error("Unable to load survey responses", error);
    await feedback.error(
      "No fue posible cargar las encuestas",
      error,
      "La lista de respuestas no pudo cargarse.",
    );
  } finally {
    loading.value = false;
  }
}

async function openSurvey(survey) {
  selectedSurveyId.value = survey.id;

  if (normalizeStatus(survey.status) !== "nuevo") {
    return;
  }

  try {
    const updatedSurvey = await updateSurveyResponse(survey.id, {
      status: "revisado",
    });
    applySurveyUpdate(updatedSurvey);
    selectedStatus.value = "revisado";
    editForm.value.status = "revisado";
    await feedback.notify("Encuesta marcada como revisada");
  } catch (error) {
    console.error("Unable to mark survey as reviewed", error);
    await feedback.error(
      "No fue posible actualizar el estado",
      error,
      "La encuesta se abrió, pero no pudimos marcarla como revisada.",
    );
  }
}

function closeModal() {
  selectedSurveyId.value = null;
  editMode.value = false;
}

async function saveStatus() {
  if (!selectedSurvey.value) return;

  savingStatus.value = true;

  try {
    const updatedSurvey = await updateSurveyResponse(selectedSurvey.value.id, {
      status: selectedStatus.value,
    });
    applySurveyUpdate(updatedSurvey);
    editForm.value.status = normalizeStatus(updatedSurvey.status);
    await feedback.success("Estado actualizado");
  } catch (error) {
    console.error("Unable to update survey status", error);
    await feedback.error("No fue posible actualizar el estado", error);
  } finally {
    savingStatus.value = false;
  }
}

async function saveNotes() {
  if (!selectedSurvey.value) return;

  savingNotes.value = true;

  try {
    const updatedSurvey = await updateSurveyResponse(selectedSurvey.value.id, {
      notes: notesDraft.value,
    });
    applySurveyUpdate(updatedSurvey);
    editForm.value.notes = updatedSurvey.notes || "";
    await feedback.success("Notas guardadas");
  } catch (error) {
    console.error("Unable to update survey notes", error);
    await feedback.error("No fue posible guardar las notas", error);
  } finally {
    savingNotes.value = false;
  }
}

async function saveEdit() {
  if (!selectedSurvey.value) return;

  savingEdit.value = true;

  try {
    const updatedSurvey = await updateSurveyResponse(selectedSurvey.value.id, {
      lead_name: editForm.value.lead_name.trim() || null,
      lead_contact: editForm.value.lead_contact.trim() || null,
      status: editForm.value.status,
      notes: editForm.value.notes,
    });

    applySurveyUpdate(updatedSurvey);
    selectedStatus.value = normalizeStatus(updatedSurvey.status);
    notesDraft.value = updatedSurvey.notes || "";
    editMode.value = false;
    await feedback.success("Información actualizada");
  } catch (error) {
    console.error("Unable to edit survey response", error);
    await feedback.error("No fue posible guardar los cambios", error);
  } finally {
    savingEdit.value = false;
  }
}

async function confirmDelete(survey = selectedSurvey.value) {
  if (!survey) return;

  const result = await feedback.confirm({
    title: "¿Deseas eliminar esta respuesta?",
    text: "Esta acción no se puede deshacer.",
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    icon: "warning",
    confirmButtonColor: "#b91c1c",
  });

  if (!result.isConfirmed) {
    return;
  }

  deleting.value = true;

  try {
    await deleteSurveyResponse(survey.id);
    surveys.value = surveys.value.filter((item) => item.id !== survey.id);

    if (selectedSurveyId.value === survey.id) {
      closeModal();
    }

    if (currentPage.value > totalPages.value && totalPages.value > 0) {
      currentPage.value = totalPages.value;
    }

    await feedback.success("Respuesta eliminada");
  } catch (error) {
    console.error("Unable to delete survey response", error);
    await feedback.error("No fue posible eliminar la respuesta", error);
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  await loadSurveys();
});
</script>

<template>
  <section class="surveys-page">
    <header class="page-hero">
      <div>
        <p class="eyebrow">Customer insights</p>
        <h1>Encuestas</h1>
        <p class="subtitle">Respuestas de experiencia del cliente</p>
      </div>

      <div class="hero-actions">
        <BaseButton variant="secondary" :disabled="loading" @click="loadSurveys">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </BaseButton>
      </div>
    </header>

    <section class="stats-grid">
      <StatCard title="Total" :value="metrics.total" hint="Respuestas registradas" />
      <StatCard title="Nuevas" :value="metrics.nuevas" hint="Pendientes de revisar" />
      <StatCard title="Revisadas" :value="metrics.revisadas" hint="Ya abiertas por el equipo" />
      <StatCard title="Contactadas" :value="metrics.contactadas" hint="Con seguimiento activo" />
      <StatCard title="Descartadas" :value="metrics.descartadas" hint="Fuera de seguimiento" />
    </section>

    <section class="filters-card panel">
      <label class="filter-field filter-search">
        <span>Buscar</span>
        <input
          v-model="searchTerm"
          type="search"
          placeholder="Buscar por nombre, contacto o comentario..."
        />
      </label>

      <label class="filter-field">
        <span>Estado</span>
        <select v-model="statusFilter">
          <option value="all">Todos</option>
          <option
            v-for="option in SURVEY_STATUS_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="filter-field">
        <span>Origen</span>
        <select v-model="sourceFilter">
          <option
            v-for="option in SURVEY_SOURCE_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
    </section>

    <div v-if="loading" class="state">Cargando respuestas...</div>
    <div v-else-if="!filteredSurveys.length" class="state state-empty">
      No hay respuestas que coincidan con los filtros actuales.
    </div>

    <section v-else class="table-card">
      <BaseTable :rows="paginatedItems">
        <template #columns>
          <th>Fecha</th>
          <th>Nombre</th>
          <th>Contacto</th>
          <th>Origen</th>
          <th>Probabilidad de uso</th>
          <th>Estado</th>
          <th class="actions-column">Acciones</th>
        </template>

        <template #row="{ row: survey }">
          <td class="cell-clickable" @click="openSurvey(survey)">{{ formatDate(survey.created_at) }}</td>
          <td class="cell-clickable" @click="openSurvey(survey)">{{ formatLeadName(survey.lead_name) }}</td>
          <td class="cell-clickable" @click="openSurvey(survey)">{{ formatLeadContact(survey.lead_contact) }}</td>
          <td class="cell-clickable" @click="openSurvey(survey)">{{ getSourceLabel(survey.source) }}</td>
          <td class="cell-clickable" @click="openSurvey(survey)">{{ survey.q5 || "-" }}</td>
          <td class="cell-clickable" @click="openSurvey(survey)">
            <span class="status-badge" :class="`status-${normalizeStatus(survey.status)}`">
              {{ getStatusLabel(survey.status) }}
            </span>
          </td>
          <td class="actions-cell">
            <div class="row-actions">
              <BaseButton variant="secondary" @click="openSurvey(survey)">Ver</BaseButton>
              <BaseButton variant="danger" :disabled="deleting" @click="confirmDelete(survey)">
                Eliminar
              </BaseButton>
            </div>
          </td>
        </template>
      </BaseTable>

      <div class="pagination-bar">
        <p>
          Mostrando {{ paginatedItems.length }} de {{ filteredSurveys.length }} respuestas
        </p>

        <div class="pagination-actions">
          <BaseButton
            variant="secondary"
            :disabled="currentPage <= 1"
            @click="prevPage"
          >
            Anterior
          </BaseButton>
          <span>Pagina {{ currentPage }} de {{ Math.max(totalPages, 1) }}</span>
          <BaseButton
            variant="secondary"
            :disabled="currentPage >= totalPages"
            @click="nextPage"
          >
            Siguiente
          </BaseButton>
        </div>
      </div>
    </section>

    <BaseModal
      :open="Boolean(selectedSurvey)"
      title="Detalle de encuesta"
      max-width="920px"
      hide-footer
      @close="closeModal"
    >
      <template v-if="selectedSurvey">
        <section class="detail-layout">
          <div class="detail-primary">
            <article class="detail-card panel">
              <div class="detail-head">
                <div>
                  <p class="detail-eyebrow">Información</p>
                  <h2>{{ formatLeadName(selectedSurvey.lead_name) }}</h2>
                  <p class="detail-subtitle">
                    {{ getSourceLabel(selectedSurvey.source) }} · {{ formatDate(selectedSurvey.created_at) }}
                  </p>
                </div>

                <span class="status-badge" :class="`status-${normalizeStatus(selectedSurvey.status)}`">
                  {{ getStatusLabel(selectedSurvey.status) }}
                </span>
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <span>Nombre</span>
                  <strong>{{ formatLeadName(selectedSurvey.lead_name) }}</strong>
                </div>
                <div class="info-item">
                  <span>Contacto</span>
                  <strong>{{ formatLeadContact(selectedSurvey.lead_contact) }}</strong>
                </div>
                <div class="info-item">
                  <span>Origen</span>
                  <strong>{{ getSourceLabel(selectedSurvey.source) }}</strong>
                </div>
                <div class="info-item">
                  <span>Fecha</span>
                  <strong>{{ formatDate(selectedSurvey.created_at) }}</strong>
                </div>
              </div>
            </article>

            <article class="detail-card panel">
              <h3>Respuestas</h3>

              <div class="answer-block">
                <span>¿Cómo solicitas normalmente tus vuelos privados?</span>
                <p>{{ selectedSurvey.q1 || "-" }}</p>
              </div>

              <div class="answer-block">
                <span>¿Qué tan satisfecho estás con el proceso actual?</span>
                <p>{{ selectedSurvey.q2 || "-" }}</p>
              </div>

              <div class="answer-block">
                <span>¿Qué parte del proceso te gustaría que fuera más sencilla o rápida?</span>
                <div class="chip-list">
                  <span
                    v-for="item in normalizeToList(selectedSurvey.q3)"
                    :key="item"
                    class="chip"
                  >
                    {{ item }}
                  </span>
                  <p v-if="!normalizeToList(selectedSurvey.q3).length">-</p>
                </div>
              </div>

              <div class="answer-block">
                <span>¿Qué funciones de una aplicación te resultarían más útiles?</span>
                <div class="chip-list">
                  <span
                    v-for="item in normalizeToList(selectedSurvey.q4)"
                    :key="item"
                    class="chip"
                  >
                    {{ item }}
                  </span>
                  <p v-if="!normalizeToList(selectedSurvey.q4).length">{{ selectedSurvey.q4 || "-" }}</p>
                </div>
              </div>

              <div class="answer-block">
                <span>¿Qué tan probable sería que utilizaras una aplicación para gestionar tus vuelos privados?</span>
                <p>{{ selectedSurvey.q5 || "-" }}</p>
              </div>

              <div class="answer-block">
                <span>Comentario</span>
                <p>{{ selectedSurvey.q6 || "Sin comentario" }}</p>
              </div>
            </article>
          </div>

          <aside class="detail-sidebar">
            <article class="detail-card panel">
              <div class="sidebar-head">
                <h3>Gestión</h3>
                <BaseButton variant="secondary" @click="editMode = !editMode">
                  {{ editMode ? "Cancelar" : "Editar datos" }}
                </BaseButton>
              </div>

              <label class="field">
                <span>Estado</span>
                <select v-model="selectedStatus" :disabled="savingStatus">
                  <option
                    v-for="option in SURVEY_STATUS_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <BaseButton :disabled="savingStatus" @click="saveStatus">
                {{ savingStatus ? "Guardando..." : "Guardar estado" }}
              </BaseButton>
            </article>

            <article class="detail-card panel">
              <h3>Notas internas</h3>

              <label class="field">
                <span>Notas</span>
                <textarea
                  v-model="notesDraft"
                  rows="5"
                  placeholder="Agregar notas para el equipo..."
                />
              </label>

              <BaseButton :disabled="savingNotes" @click="saveNotes">
                {{ savingNotes ? "Guardando..." : "Guardar notas" }}
              </BaseButton>
            </article>

            <article v-if="editMode" class="detail-card panel">
              <h3>Editar información</h3>

              <label class="field">
                <span>Nombre</span>
                <input v-model="editForm.lead_name" type="text" placeholder="Nombre del prospecto" />
              </label>

              <label class="field">
                <span>Contacto</span>
                <input v-model="editForm.lead_contact" type="text" placeholder="Email o telefono" />
              </label>

              <label class="field">
                <span>Estado</span>
                <select v-model="editForm.status">
                  <option
                    v-for="option in SURVEY_STATUS_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="field">
                <span>Notas</span>
                <textarea v-model="editForm.notes" rows="4" />
              </label>

              <BaseButton :disabled="savingEdit" @click="saveEdit">
                {{ savingEdit ? "Guardando..." : "Guardar cambios" }}
              </BaseButton>
            </article>

            <article class="detail-card panel danger-card">
              <h3>Eliminar respuesta</h3>
              <p>Esta acción elimina la respuesta seleccionada de forma permanente.</p>
              <BaseButton variant="danger" :disabled="deleting" @click="confirmDelete()">
                {{ deleting ? "Eliminando..." : "Eliminar" }}
              </BaseButton>
            </article>
          </aside>
        </section>
      </template>
    </BaseModal>
  </section>
</template>

<style scoped>
.surveys-page {
  display: grid;
  gap: 24px;
  padding: 28px 24px 36px;
}

.page-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: start;
  padding: 24px;
  border-radius: 28px;
  border: 1px solid var(--border-color);
  background:
    radial-gradient(circle at top right, rgba(15, 95, 166, 0.16), transparent 24%),
    linear-gradient(135deg, var(--bg-surface-solid) 0%, var(--bg-soft) 100%);
  box-shadow: var(--shadow-md);
}

.eyebrow,
.detail-eyebrow {
  margin: 0 0 6px;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primary);
}

.page-hero h1,
.detail-head h2 {
  margin: 0;
  color: var(--text-strong);
}

.subtitle,
.detail-subtitle {
  margin: 10px 0 0;
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
}

.filters-card {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(2, minmax(180px, 1fr));
  gap: 16px;
  padding: 20px;
  border-radius: 24px;
}

.filter-field,
.field {
  display: grid;
  gap: 8px;
}

.filter-field span,
.field span,
.info-item span,
.answer-block span {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-faint);
  letter-spacing: 0.04em;
}

.filter-field input,
.filter-field select,
.field input,
.field select,
.field textarea {
  min-height: 46px;
  padding: 12px 14px;
}

.field textarea {
  min-height: 120px;
  resize: vertical;
}

.table-card {
  display: grid;
  gap: 16px;
}

.survey-row {
  cursor: pointer;
}

.actions-column,
.actions-cell {
  width: 1%;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  gap: 10px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.status-nuevo {
  background: rgba(217, 119, 6, 0.14);
  color: var(--warning);
}

.status-revisado {
  background: rgba(15, 95, 166, 0.12);
  color: var(--primary);
}

.status-contactado {
  background: rgba(21, 128, 61, 0.14);
  color: var(--success);
}

.status-descartado {
  background: rgba(198, 40, 40, 0.12);
  color: var(--danger);
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.pagination-bar p {
  margin: 0;
  color: var(--text-muted);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.state {
  padding: 36px 20px;
  text-align: center;
  border-radius: 24px;
  border: 1px dashed var(--border-color);
  color: var(--text-muted);
  background: var(--bg-surface);
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(300px, 0.9fr);
  gap: 18px;
}

.detail-primary,
.detail-sidebar {
  display: grid;
  gap: 18px;
}

.detail-card {
  padding: 20px;
  border-radius: 22px;
}

.detail-head,
.sidebar-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.info-item,
.answer-block {
  display: grid;
  gap: 8px;
}

.info-item strong,
.answer-block p,
.danger-card p {
  margin: 0;
  color: var(--text-main);
}

.answer-block + .answer-block {
  margin-top: 18px;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 700;
}

.danger-card {
  border-color: rgba(198, 40, 40, 0.22);
}

@media (max-width: 1080px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .filters-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .surveys-page {
    padding: 18px 0 24px;
  }

  .page-hero,
  .pagination-bar,
  .detail-head,
  .sidebar-head {
    flex-direction: column;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .row-actions,
  .pagination-actions {
    flex-wrap: wrap;
  }
}
</style>
