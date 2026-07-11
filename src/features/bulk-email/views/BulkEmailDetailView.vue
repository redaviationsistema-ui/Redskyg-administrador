<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import { useFeedback } from "@/composables/useFeedback";
import BulkEmailPreview from "../components/BulkEmailPreview.vue";
import BulkEmailProgress from "../components/BulkEmailProgress.vue";
import BulkEmailRecipientsTable from "../components/BulkEmailRecipientsTable.vue";
import BulkEmailStatusBadge from "../components/BulkEmailStatusBadge.vue";
import { useBulkEmailCampaigns } from "../composables/useBulkEmailCampaigns";
import { useBulkEmailProgress } from "../composables/useBulkEmailProgress";
import { useBulkEmailRecipients } from "../composables/useBulkEmailRecipients";
import { deriveCampaignSummaryMetrics } from "../utils/bulkEmailCampaignState";

const route = useRoute();
const router = useRouter();
const feedback = useFeedback();
const resource = useBulkEmailCampaigns();

const loading = ref(true);
const campaign = ref(null);
const activeTab = ref("summary");
const campaignId = computed(() => route.params.id);
const campaignStatus = computed(() => campaign.value?.status || "");
const progress = useBulkEmailProgress(campaignStatus, campaignId);
const recipients = useBulkEmailRecipients(campaignId);
const {
  progress: progressData,
  loading: progressLoading,
  error: progressError,
} = progress;
const {
  recipientRows,
  totalPages: recipientTotalPages,
  loading: recipientsLoading,
  pagination: recipientsPagination,
  loadRecipients,
} = recipients;
const {
  deliveries,
  deliveryPages,
} = resource;
const summaryMetrics = computed(() =>
  deriveCampaignSummaryMetrics(campaign.value || {}, {
    recipientTotal: recipientsPagination.total,
    progress: progressData.value,
  }),
);

const tabs = [
  { id: "summary", label: "Resumen" },
  { id: "recipients", label: "Destinatarios" },
  { id: "deliveries", label: "Entregas" },
  { id: "preview", label: "Vista previa" },
  { id: "settings", label: "Configuración" },
];

async function loadCampaign() {
  loading.value = true;
  try {
    campaign.value = await resource.getById(route.params.id);
    await Promise.all([loadRecipients(), resource.loadDeliveries(route.params.id)]);
  } catch (error) {
    feedback.error("No fue posible cargar la campaña", error);
    router.push("/correos-masivos");
  } finally {
    loading.value = false;
  }
}

watch(
  () => resource.deliveriesState.page,
  async () => {
    if (campaignId.value) {
      await resource.loadDeliveries(campaignId.value);
    }
  },
);

watch(
  () => recipients.pagination.page,
  async () => {
    if (campaignId.value) {
      await loadRecipients();
    }
  },
);

onMounted(loadCampaign);

watch(
  () => route.params.id,
  async () => {
    await loadCampaign();
  },
);

watch(
  () => progressData.value,
  async (value) => {
    if (!value || !campaignId.value) {
      return;
    }

    await Promise.allSettled([loadRecipients(), resource.loadDeliveries(campaignId.value)]);
  },
);
</script>

<template>
  <section class="page-shell detail-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Marketing communication</p>
        <h1>{{ campaign?.subject || "Detalle de campaña" }}</h1>
      </div>
      <div class="head-actions">
        <BaseButton variant="secondary" @click="router.push(`/correos-masivos/${route.params.id}/editar`)">Editar</BaseButton>
        <BaseButton variant="secondary" @click="router.push('/correos-masivos')">Volver</BaseButton>
      </div>
    </header>

    <div v-if="loading" class="state-box">Cargando detalle...</div>
    <template v-else-if="campaign">
      <section class="summary-card">
        <div>
          <span class="eyebrow">Resumen</span>
          <h2>{{ campaign.internal_name }}</h2>
          <p class="meta-line">
            <BulkEmailStatusBadge :status="campaign.status" />
          </p>
        </div>

        <div class="summary-grid">
          <article><span>Remitente</span><strong>{{ campaign.sender_name || "-" }}</strong></article>
          <article><span>Correo</span><strong>{{ campaign.sender_email || "-" }}</strong></article>
          <article><span>Reply-To</span><strong>{{ campaign.reply_to || "-" }}</strong></article>
          <article><span>Fecha</span><strong>{{ campaign.created_at ? new Date(campaign.created_at).toLocaleString("es-MX") : "-" }}</strong></article>
          <article><span>Total destinatarios</span><strong>{{ summaryMetrics.totalRecipients }}</strong></article>
          <article><span>Enviados</span><strong>{{ summaryMetrics.sentCount }}</strong></article>
          <article><span>Fallidos</span><strong>{{ summaryMetrics.failedCount }}</strong></article>
          <article><span>Pendientes</span><strong>{{ summaryMetrics.pendingCount }}</strong></article>
        </div>
      </section>

      <BulkEmailProgress :progress="progressData" :loading="progressLoading" :error="progressError" />

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="activeTab === 'summary'" class="tab-card">
        <h3>Resumen de campaña</h3>
        <p>La campaña se apoya en las columnas reales detectadas en Supabase Inventory y en el progreso reportado por el backend PHP.</p>
      </section>

      <section v-else-if="activeTab === 'recipients'" class="tab-card">
        <BulkEmailRecipientsTable
          :rows="recipientRows"
          :loading="recipientsLoading"
          :page="recipientsPagination.page"
          :total-pages="recipientTotalPages"
          @page-change="(page) => (recipientsPagination.page = page)"
        />
      </section>

      <section v-else-if="activeTab === 'deliveries'" class="tab-card">
        <div v-if="resource.deliveriesState.loading" class="state-box">Cargando entregas...</div>
        <div v-else-if="resource.deliveriesState.error" class="state-box state-error">{{ resource.deliveriesState.error }}</div>
        <div v-else-if="!deliveries.length" class="state-box">Sin entregas registradas.</div>
        <template v-else>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Sent</th>
                  <th>Delivered</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                  <th>Error</th>
                  <th>Provider ID</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in deliveries" :key="row.id">
                  <td><BulkEmailStatusBadge :status="row.status" /></td>
                  <td>{{ row.sent_at ? new Date(row.sent_at).toLocaleString("es-MX") : "-" }}</td>
                  <td>{{ row.delivered_at ? new Date(row.delivered_at).toLocaleString("es-MX") : "-" }}</td>
                  <td>{{ row.opened_at ? new Date(row.opened_at).toLocaleString("es-MX") : "-" }}</td>
                  <td>{{ row.clicked_at ? new Date(row.clicked_at).toLocaleString("es-MX") : "-" }}</td>
                  <td>{{ row.error_message || "-" }}</td>
                  <td>{{ row.provider_message_id || "-" }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pagination">
            <BaseButton variant="secondary" :disabled="resource.deliveriesState.page <= 1" @click="resource.deliveriesState.page -= 1">
              Anterior
            </BaseButton>
            <span>Página {{ resource.deliveriesState.page }} de {{ deliveryPages }}</span>
            <BaseButton variant="secondary" :disabled="resource.deliveriesState.page >= deliveryPages" @click="resource.deliveriesState.page += 1">
              Siguiente
            </BaseButton>
          </div>
        </template>
      </section>

      <section v-else-if="activeTab === 'preview'" class="tab-card">
        <BulkEmailPreview :values="campaign" :image-preview-url="campaign.image_preview_url" />
      </section>

      <section v-else class="tab-card">
        <h3>Configuración</h3>
        <ul class="config-list">
          <li>`subject`, `status`, `sender_name`, `sender_email`, `reply_to` son persistentes.</li>
          <li>`image_url` e `image_path` están disponibles para la imagen principal.</li>
          <li>No se detectaron columnas públicas para HTML, texto plano, CTA, programación ni imágenes adicionales.</li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.detail-page {
  display: grid;
  gap: 24px;
  padding: 28px 24px 36px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.head-actions {
  display: flex;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.76rem;
  font-weight: 800;
}

.page-head h1,
.summary-card h2,
.tab-card h3 {
  margin: 0;
}

.summary-card,
.tab-card {
  display: grid;
  gap: 18px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-sm);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.summary-grid article {
  padding: 14px;
  border-radius: 16px;
  background: var(--bg-soft);
}

.summary-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.summary-grid strong {
  color: var(--text-strong);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tab-btn {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
}

.tab-btn.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: white;
}

.state-box {
  padding: 24px;
  border-radius: 22px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  text-align: center;
  color: var(--text-muted);
}

.state-error {
  color: var(--danger);
}

.table-wrap {
  overflow-x: auto;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-main);
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .detail-page {
    padding: 20px 16px 30px;
  }

  .page-head,
  .head-actions,
  .pagination {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
