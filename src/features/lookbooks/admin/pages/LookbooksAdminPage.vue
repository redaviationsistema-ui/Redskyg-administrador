<script setup>
import { computed, onMounted, ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import StatCard from "@/components/ui/StatCard.vue";
import { useFeedback } from "@/composables/useFeedback";
import LookbookDownloadsModal from "../components/LookbookDownloadsModal.vue";
import LookbookFormModal from "../components/LookbookFormModal.vue";
import LookbooksTable from "../components/LookbooksTable.vue";
import { LOOKBOOK_CATEGORY_OPTIONS } from "../services/lookbooksAdmin.service";
import { useLookbooksAdmin } from "../composables/useLookbooksAdmin";

const feedback = useFeedback();
const admin = useLookbooksAdmin();
const {
  lookbooks,
  totalPages,
  hasActiveFilters,
  downloadsTarget,
  downloadsRows,
  downloadsLoading,
  downloadsError,
  downloadsPages,
} = admin;

const editorOpen = ref(false);
const editorMode = ref("create");
const selectedLookbook = ref(null);

const statCards = computed(() => [
  { title: "Total de lookbooks", value: admin.stats.total, hint: "Registros en la biblioteca" },
  { title: "Lookbooks activos", value: admin.stats.active, hint: "Disponibles actualmente" },
  { title: "Lookbooks inactivos", value: admin.stats.inactive, hint: "Ocultos o deshabilitados" },
  { title: "Acceso protegido", value: admin.stats.protected, hint: "Requieren autenticación" },
  { title: "Descargas totales", value: admin.stats.downloads, hint: "Histórico completo" },
]);

function openCreateModal() {
  editorMode.value = "create";
  selectedLookbook.value = null;
  editorOpen.value = true;
}

function openEditModal(item) {
  editorMode.value = "edit";
  selectedLookbook.value = item;
  editorOpen.value = true;
}

function closeEditor() {
  if (admin.state.saving) {
    return;
  }

  editorOpen.value = false;
}

async function handleFormSubmit(payload) {
  try {
    await admin.submitLookbook({
      mode: editorMode.value,
      lookbookId: selectedLookbook.value?.id,
      ...payload,
    });
    editorOpen.value = false;
  } catch (error) {
    feedback.error(
      editorMode.value === "create" ? "No fue posible crear el lookbook" : "No fue posible actualizar el lookbook",
      error,
    );
  }
}

onMounted(async () => {
  await admin.initialize();
});
</script>

<template>
  <section class="lookbooks-page page-shell">
    <div class="page-hero">
      <div>
        <p class="eyebrow">Biblioteca administrativa</p>
        <h2>Lookbooks</h2>
        <p class="hero-copy">
          Gestiona publicaciones, archivos y descargas desde Supabase sin tocar la parte pública.
        </p>
      </div>

      <div class="hero-actions">
        <BaseButton variant="secondary" :disabled="admin.state.refreshing" @click="admin.refreshData({ silent: true })">
          {{ admin.state.refreshing ? "Actualizando..." : "Actualizar datos" }}
        </BaseButton>
        <BaseButton :disabled="admin.state.saving" @click="openCreateModal">Nuevo lookbook</BaseButton>
      </div>
    </div>

    <div class="stats-grid">
      <StatCard
        v-for="card in statCards"
        :key="card.title"
        :title="card.title"
        :value="admin.state.statsLoading ? '...' : card.value"
        :hint="card.hint"
      />
    </div>

    <section class="filters-panel panel">
      <div class="filters-grid">
        <label class="filter-field">
          <span>Buscar</span>
          <input
            v-model.trim="admin.filters.search"
            type="text"
            placeholder="Buscar por título o aeronave"
          />
        </label>

        <label class="filter-field">
          <span>Categoría</span>
          <select v-model="admin.filters.category">
            <option value="all">Todas</option>
            <option v-for="option in LOOKBOOK_CATEGORY_OPTIONS" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </label>

        <label class="filter-field">
          <span>Estado</span>
          <select v-model="admin.filters.status">
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>

        <label class="filter-field">
          <span>Tipo de acceso</span>
          <select v-model="admin.filters.access">
            <option value="all">Todos</option>
            <option value="public">Público</option>
            <option value="protected">Protegido</option>
          </select>
        </label>

        <label class="filter-field">
          <span>Orden de publicación</span>
          <select v-model="admin.filters.order">
            <option value="manual_asc">Orden manual ascendente</option>
            <option value="manual_desc">Orden manual descendente</option>
            <option value="published_desc">Más recientes primero</option>
            <option value="published_asc">Más antiguos primero</option>
            <option value="title_asc">Título A-Z</option>
            <option value="title_desc">Título Z-A</option>
          </select>
        </label>
      </div>

      <div class="filters-actions">
        <p class="filters-summary">
          {{ admin.pagination.total }} registro<span v-if="admin.pagination.total !== 1">s</span> encontrados
        </p>
        <BaseButton
          variant="secondary"
          :disabled="!hasActiveFilters"
          @click="admin.resetFilters()"
        >
          Limpiar filtros
        </BaseButton>
      </div>
    </section>

    <LookbooksTable
      :rows="lookbooks"
      :loading="admin.state.loading"
      :error="admin.state.error"
      :page="admin.pagination.page"
      :total-pages="totalPages"
      :row-action="admin.rowAction"
      @preview="admin.previewLookbook"
      @edit="openEditModal"
      @toggle="admin.toggleStatus"
      @downloads="admin.openDownloads"
      @delete="admin.removeLookbook"
      @page-change="admin.setPage"
    />

    <LookbookFormModal
      :open="editorOpen"
      :mode="editorMode"
      :initial-value="selectedLookbook"
      :saving="admin.state.saving"
      :upload-state="admin.uploadState"
      @close="closeEditor"
      @submit="handleFormSubmit"
    />

    <LookbookDownloadsModal
      :open="Boolean(downloadsTarget)"
      :lookbook="downloadsTarget"
      :rows="downloadsRows"
      :loading="downloadsLoading"
      :error="downloadsError"
      :page="admin.downloadsPagination.page"
      :total-pages="downloadsPages"
      :total="admin.downloadsPagination.total"
      @close="admin.closeDownloads"
      @page-change="admin.setDownloadsPage"
    />
  </section>
</template>

<style scoped>
.lookbooks-page {
  display: grid;
  gap: 24px;
  padding: 28px 24px 36px;
}

.page-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding: 24px;
  border-radius: 28px;
  border: 1px solid var(--border-color);
  background:
    radial-gradient(circle at top right, rgba(15, 95, 166, 0.16), transparent 26%),
    linear-gradient(135deg, var(--bg-surface-solid) 0%, var(--bg-soft) 100%);
  box-shadow: var(--shadow-md);
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primary);
}

.page-hero h2 {
  margin: 0;
  font-size: 2rem;
  color: var(--text-strong);
}

.hero-copy {
  max-width: 720px;
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.filters-panel {
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 24px;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.filter-field {
  display: grid;
  gap: 8px;
}

.filter-field span {
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-strong);
}

.filter-field input,
.filter-field select {
  padding: 12px 14px;
}

.filters-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.filters-summary {
  margin: 0;
  color: var(--text-muted);
  font-weight: 700;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .filters-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .lookbooks-page {
    padding: 20px 16px 30px;
  }

  .page-hero,
  .filters-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-actions {
    justify-content: flex-start;
  }

  .stats-grid,
  .filters-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .stats-grid,
  .filters-grid {
    grid-template-columns: 1fr;
  }

  .page-hero h2 {
    font-size: 1.7rem;
  }
}
</style>
