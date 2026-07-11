<script setup>
import { onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import { useFeedback } from "@/composables/useFeedback";
import BulkEmailCampaignTable from "../components/BulkEmailCampaignTable.vue";
import BulkEmailStats from "../components/BulkEmailStats.vue";
import { useBulkEmailCampaigns } from "../composables/useBulkEmailCampaigns";
import { getBulkEmailApiDiagnosticMessage } from "../services/bulkEmailApi.service";

const router = useRouter();
const feedback = useFeedback();
const campaigns = useBulkEmailCampaigns();
const {
  campaigns: campaignRows,
  totalPages,
  stats,
} = campaigns;
const apiDiagnosticMessage = getBulkEmailApiDiagnosticMessage();

async function promptSendTest(campaign) {
  const result = await feedback.confirm({
    title: "Enviar prueba",
    text: "Se solicitará el correo de prueba en el siguiente paso.",
    confirmButtonText: "Continuar",
    cancelButtonText: "Cancelar",
  });

  if (!result.isConfirmed) {
    return;
  }

  const email = window.prompt("Correo de prueba");
  if (!email) {
    return;
  }

  const response = await campaigns.sendTest(campaign, email);
  if (response) {
    feedback.success("Prueba enviada", "La API respondió correctamente.");
  }
}

onMounted(async () => {
  await campaigns.refreshAll();
});

watch(
  () => [campaigns.filters.search, campaigns.filters.status, campaigns.filters.startDate, campaigns.filters.endDate],
  async () => {
    campaigns.pagination.page = 1;
    await campaigns.loadCampaigns({ silent: true });
  },
);

watch(
  () => campaigns.pagination.page,
  async () => {
    await campaigns.loadCampaigns({ silent: true });
  },
);
</script>

<template>
  <section class="bulk-email-page page-shell">
    <header class="page-hero">
      <div>
        <p class="eyebrow">Marketing communication</p>
        <h1>Correos masivos</h1>
        <p class="subtitle">
          Administra campañas, destinatarios, imágenes y seguimiento de envíos.
        </p>
      </div>

      <div class="hero-actions">
        <BaseButton variant="secondary" :disabled="campaigns.state.refreshing" @click="campaigns.refreshAll({ silent: true })">
          {{ campaigns.state.refreshing ? "Actualizando..." : "Actualizar" }}
        </BaseButton>
        <BaseButton @click="router.push('/correos-masivos/nueva')">Nueva campaña</BaseButton>
      </div>
    </header>

    <BulkEmailStats :stats="stats" />

    <section v-if="campaigns.state.warning || apiDiagnosticMessage" class="diagnostic-card panel">
      <p v-if="campaigns.state.warning" class="diagnostic-warning">
        {{ campaigns.state.warning }}
      </p>
      <p class="diagnostic-info">{{ apiDiagnosticMessage }}</p>
      <div class="diagnostic-actions">
        <BaseButton variant="secondary" @click="router.push('/inventory-login?redirect=/correos-masivos')">
          Reautenticar Inventory
        </BaseButton>
      </div>
    </section>
    

    <section class="filters-card panel">
      <label class="field">
        <span>Buscar por nombre o asunto</span>
        <input v-model.trim="campaigns.filters.search" type="search" placeholder="Asunto o remitente" />
      </label>

      <label class="field">
        <span>Estado</span>
        <select v-model="campaigns.filters.status">
          <option value="all">Todos</option>
          <option value="draft">Borrador</option>
          <option value="scheduled">Programada</option>
          <option value="processing">En proceso</option>
          <option value="completed">Completada</option>
          <option value="paused">Pausada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </label>

      <label class="field">
        <span>Fecha inicial</span>
        <input v-model="campaigns.filters.startDate" type="date" />
      </label>

      <label class="field">
        <span>Fecha final</span>
        <input v-model="campaigns.filters.endDate" type="date" />
      </label>

      <div class="filter-actions">
        <BaseButton variant="secondary" @click="campaigns.resetFilters()">Limpiar</BaseButton>
      </div>
    </section>

    <BulkEmailCampaignTable
      :rows="campaignRows"
      :loading="campaigns.state.loading"
      :error="campaigns.state.error"
      :page="campaigns.pagination.page"
      :total-pages="totalPages"
      :busy-id="campaigns.state.actionId"
      :busy-type="campaigns.state.actionType"
      :deleting-id="campaigns.state.deletingId"
      @view="(row) => router.push(`/correos-masivos/${row.id}`)"
      @edit="(row) => router.push(`/correos-masivos/${row.id}/editar`)"
      @duplicate="campaigns.duplicate"
      @send-test="promptSendTest"
      @start="campaigns.start"
      @pause="campaigns.pause"
      @resume="campaigns.resume"
      @cancel="campaigns.cancel"
      @delete="campaigns.confirmAndDelete"
      @progress="(row) => router.push(`/correos-masivos/${row.id}`)"
      @page-change="(page) => (campaigns.pagination.page = page)"
    />
  </section>
</template>

<style scoped>
.bulk-email-page {
  display: grid;
  gap: 24px;
  padding: 28px 24px 36px;
}

.page-hero {
  display: flex;
  justify-content: space-between;
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
}

.subtitle {
  margin: 10px 0 0;
  max-width: 760px;
  color: var(--text-muted);
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filters-card {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  padding: 20px;
  border-radius: 24px;
}

.diagnostic-card {
  display: grid;
  gap: 10px;
  padding: 18px 20px;
  border-radius: 24px;
}

.diagnostic-warning {
  margin: 0;
  color: var(--warning);
  font-weight: 700;
}

.diagnostic-info {
  margin: 0;
  color: var(--text-muted);
}

.diagnostic-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-weight: 800;
  color: var(--text-strong);
  font-size: 0.82rem;
}

.field input,
.field select {
  padding: 12px 14px;
}

.filter-actions {
  display: flex;
  align-items: end;
}

@media (max-width: 1024px) {
  .filters-card {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .bulk-email-page {
    padding: 20px 16px 30px;
  }

  .page-hero {
    flex-direction: column;
  }

  .hero-actions {
    justify-content: flex-start;
  }

  .filters-card {
    grid-template-columns: 1fr;
  }
}
</style>
