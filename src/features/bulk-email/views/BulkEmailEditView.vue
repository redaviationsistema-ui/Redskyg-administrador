<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFeedback } from "@/composables/useFeedback";
import BulkEmailCampaignForm from "../components/BulkEmailCampaignForm.vue";
import { sendCampaignToAll, sendTestCampaign } from "../services/bulkEmailApi.service";
import { getCampaignById, updateCampaign } from "../services/bulkEmail.service";
import { buildBulkEmailApiPayload } from "../utils/bulkEmailTemplate";

const route = useRoute();
const router = useRouter();
const feedback = useFeedback();

const loading = ref(true);
const campaign = ref(null);
const saving = ref(false);
const sending = ref(false);
const sendingProgress = ref({
  current: 0,
  total: 0,
  sent: 0,
  failed: 0,
});

async function loadCampaign() {
  loading.value = true;
  try {
    campaign.value = await getCampaignById(route.params.id);
  } catch (error) {
    feedback.error("No fue posible cargar la campaña", error);
    router.push("/correos-masivos");
  } finally {
    loading.value = false;
  }
}

async function saveDraft(values) {
  saving.value = true;
  try {
    campaign.value = await updateCampaign(route.params.id, values);
    feedback.success("Cambios guardados", "La campaña fue actualizada.");
  } catch (error) {
    feedback.error("No fue posible actualizar la campaña", error);
  } finally {
    saving.value = false;
  }
}

async function startFlow(values) {
  if (sending.value) {
    return;
  }

  sending.value = true;
  try {
    campaign.value = await updateCampaign(route.params.id, values);
    const result = await sendCampaignToAll(route.params.id, buildBulkEmailApiPayload(values), {
      onProgress: (nextProgress) => {
        sendingProgress.value = nextProgress;
      },
    });
    campaign.value = await getCampaignById(route.params.id);
    feedback.success(
      "Envio finalizado",
      `Enviados: ${result.sent}. Fallidos: ${result.failed}. Pendientes: ${result.summary?.pending ?? 0}.`,
    );
    router.replace("/correos-masivos");
  } catch (error) {
    feedback.error("No fue posible enviar a todos", error);
  } finally {
    sending.value = false;
  }
}

async function ensureCampaign(values) {
  campaign.value = await updateCampaign(route.params.id, values);
  return campaign.value;
}

async function sendTestFlow({ campaign: campaignValues, email }) {
  saving.value = true;
  try {
    campaign.value = await updateCampaign(route.params.id, campaignValues || campaign.value || {});
    await sendTestCampaign(route.params.id, email, buildBulkEmailApiPayload(campaign.value || {}));
    feedback.success("Prueba enviada", "La campaña se actualizó y la API respondió correctamente.");
  } catch (error) {
    feedback.error("No fue posible enviar la prueba", error);
  } finally {
    saving.value = false;
  }
}

onMounted(loadCampaign);

watch(
  () => route.params.id,
  async () => {
    await loadCampaign();
  },
);
</script>

<template>
  <section class="page-shell page-wrap">
    <header class="page-head">
      <div>
        <p class="eyebrow">Correos masivos</p>
        <h1>Enviar correo masivo</h1>
      </div>
    </header>

    <div v-if="loading" class="state-box">Cargando campaña...</div>
    <BulkEmailCampaignForm
      v-else
      :campaign="campaign"
      :saving="saving"
      :sending="sending"
      :sending-progress="sendingProgress"
      :ensure-campaign="ensureCampaign"
      @save-draft="saveDraft"
      @start-campaign="startFlow"
      @send-test="sendTestFlow"
    />
  </section>
</template>

<style scoped>
.page-wrap {
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

.eyebrow {
  margin: 0 0 6px;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.76rem;
  font-weight: 800;
}

.page-head h1 {
  margin: 0;
}

.state-box {
  padding: 24px;
  border-radius: 22px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  color: var(--text-muted);
  text-align: center;
}
</style>


