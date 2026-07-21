<script setup>
import { computed, onMounted, watch } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import CommercialDrawer from "./components/CommercialDrawer.vue";
import CommercialFilters from "./components/CommercialFilters.vue";
import CommercialForm from "./components/CommercialForm.vue";
import CommercialStatus from "./components/CommercialStatus.vue";
import CommercialSummary from "./components/CommercialSummary.vue";
import CommercialTable from "./components/CommercialTable.vue";
import { useCommercial } from "./composables/useCommercial";

const commercial = useCommercial();
const {
  currencyOptions,
  drawerMode,
  drawerOpen,
  error,
  exporting,
  filters,
  loading,
  requestTypeOptions,
  rows,
  saving,
  selectedRecord,
  source,
  stats,
  statusOptions,
  summary,
} = commercial;

const drawerTitle = computed(() => {
  if (!selectedRecord.value) {
    return "Detalle comercial";
  }

  if (drawerMode.value === "create") {
    return "Nuevo registro comercial";
  }

  if (drawerMode.value === "edit") {
    return `Editar ${selectedRecord.value.folio}`;
  }

  return selectedRecord.value.folio || "Detalle comercial";
});

function focusFollowUp(row) {
  commercial.openView(row);
}

function focusNote(row) {
  commercial.openView(row);
}

function focusAttachment(row) {
  commercial.openView(row);
}

watch(
  () => ({ ...filters }),
  async () => {
    await commercial.refresh();
  },
  { deep: true },
);

onMounted(async () => {
  await commercial.refresh();
});
</script>

<template>
  <section class="commercial-page page-shell">
    <header class="page-hero">
      <div>
        <p class="eyebrow">Commercial workspace</p>
        <h1>Centro Comercial</h1>
        <p class="subtitle">
          Administración integral de cotizaciones, prospectos, proveedores y seguimiento comercial.
        </p>
      </div>

      <div class="hero-actions">
        <BaseButton :disabled="saving" @click="commercial.openCreateQuote()">Nueva Cotización</BaseButton>
        <BaseButton variant="secondary" :disabled="saving" @click="commercial.openCreateOpportunity()">
          Nueva Oportunidad
        </BaseButton>
        <BaseButton variant="secondary" :disabled="exporting" @click="commercial.exportExcel()">
          Exportar Excel
        </BaseButton>
        <BaseButton variant="secondary" :disabled="exporting" @click="commercial.exportCsv()">
          Exportar CSV
        </BaseButton>
        <BaseButton variant="secondary" :disabled="loading" @click="commercial.refresh()">
          {{ loading ? "Actualizando..." : "Actualizar" }}
        </BaseButton>
      </div>
    </header>

    <CommercialSummary :stats="stats" :summary="summary" :source="source" />

    <CommercialFilters
      :filters="filters"
      :currency-options="currencyOptions"
      :request-type-options="requestTypeOptions"
      :status-options="statusOptions"
      @change="commercial.updateFilter"
      @reset="commercial.resetFilters"
    />

    <CommercialTable
      :rows="rows"
      :loading="loading"
      :error="error"
      @view="commercial.openView"
      @edit="commercial.openEdit"
      @duplicate="commercial.duplicateRow"
      @email="commercial.sendEmail"
      @pdf="commercial.generatePdf"
      @status-change="commercial.changeStatus"
      @follow-up="focusFollowUp"
      @note="focusNote"
      @attachment="focusAttachment"
      @delete="commercial.removeRow"
      @retry="commercial.refresh"
    />

    <CommercialDrawer :open="drawerOpen" :title="drawerTitle" @close="commercial.closeDrawer()">
      <div v-if="selectedRecord" class="drawer-layout">
        <div class="drawer-primary">
          <div class="record-head panel">
            <div>
              <p class="record-meta">{{ selectedRecord.customerName }} · {{ selectedRecord.companyName || "Sin empresa" }}</p>
              <h2>{{ selectedRecord.route || "Nueva oportunidad comercial" }}</h2>
              <p class="record-subtitle">
                Ejecutivo {{ selectedRecord.executive || "sin asignar" }} · Próximo seguimiento
                {{ selectedRecord.nextFollowUp || "pendiente" }}
              </p>
            </div>

            <CommercialStatus
              :status="selectedRecord.status"
              :editable="drawerMode !== 'view'"
              :options="statusOptions"
              @change="commercial.changeStatus(selectedRecord, $event)"
            />
          </div>

          <CommercialForm
            :initial-value="selectedRecord"
            :mode="drawerMode"
            :saving="saving"
            :currency-options="currencyOptions"
            :request-type-options="requestTypeOptions"
            :status-options="statusOptions"
            @submit="commercial.persistRecord"
          />
        </div>

      </div>
    </CommercialDrawer>
  </section>
</template>

<style scoped>
.commercial-page {
  display: grid;
  gap: 24px;
  padding: 28px 24px 36px;
}

.page-hero {
  display: flex;
  justify-content: space-between;
  align-items: start;
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

.page-hero h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 2rem;
}

.subtitle {
  margin: 10px 0 0;
  max-width: 760px;
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.drawer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
}

.drawer-primary,
.drawer-secondary {
  display: grid;
  gap: 18px;
}

.record-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
  padding: 20px;
  border-radius: 22px;
}

.record-meta,
.record-subtitle {
  margin: 0;
  color: var(--text-muted);
}

.record-head h2 {
  margin: 6px 0;
  color: var(--text-strong);
}

@media (max-width: 1100px) {
  .drawer-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-hero {
    flex-direction: column;
  }

  .hero-actions {
    justify-content: flex-start;
  }
}
</style>
