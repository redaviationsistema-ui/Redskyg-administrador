<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useFeedback } from "@/composables/useFeedback";
import BulkEmailCampaignForm from "../components/BulkEmailCampaignForm.vue";
import { createCampaign, updateCampaign } from "../services/bulkEmail.service";
import { sendCampaignToAll, sendTestCampaign } from "../services/bulkEmailApi.service";
import { buildBulkEmailApiPayload } from "../utils/bulkEmailTemplate";

const router = useRouter();
const feedback = useFeedback();
const campaign = ref(null);
const saving = ref(false);
const sending = ref(false);
const formKey = ref(0);
const sendingProgress = ref({
  current: 0,
  total: 0,
  sent: 0,
  failed: 0,
});

async function persistCampaign(values) {
  saving.value = true;

  try {
    const savedCampaign = campaign.value?.id
      ? await updateCampaign(campaign.value.id, values)
      : await createCampaign(values);

    campaign.value = savedCampaign;
    return savedCampaign;
  } finally {
    saving.value = false;
  }
}

async function ensureCampaign(values) {
  return persistCampaign(values);
}

async function saveDraft(values) {
  try {
    const savedCampaign = await persistCampaign(values);
    feedback.success("Campaña creada", "El borrador fue guardado correctamente.");
    router.push(`/correos-masivos/${savedCampaign.id}/editar`);
  } catch (error) {
    feedback.error("No fue posible crear la campaña", error);
  }
}

async function startFlow(values) {
  if (sending.value) {
    return;
  }

  let savedCampaign = null;
  sending.value = true;

  try {
    savedCampaign = await persistCampaign(values);
    const result = await sendCampaignToAll(savedCampaign.id, buildBulkEmailApiPayload(values), {
      onProgress: (nextProgress) => {
        sendingProgress.value = nextProgress;
      },
    });
    feedback.success(
      "Envio finalizado",
      `Enviados: ${result.sent}. Fallidos: ${result.failed}. Pendientes: ${result.summary?.pending ?? 0}.`,
    );
    campaign.value = null;
    sendingProgress.value = {
      current: 0,
      total: 0,
      sent: 0,
      failed: 0,
    };
    formKey.value += 1;
  } catch (error) {
    if (savedCampaign?.id) {
      feedback.warning(
        "Campana guardada pero no enviada",
        error?.message || "Se creo el borrador, pero no fue posible completar el envio.",
      );
      return;
    }
    feedback.error("No fue posible enviar a todos", error);
  } finally {
    sending.value = false;
  }
}

async function sendTestFlow({ campaign: campaignValues, email }) {
  try {
    const savedCampaign = await persistCampaign(campaignValues);
    await sendTestCampaign(savedCampaign.id, email, buildBulkEmailApiPayload(campaignValues));
    feedback.success("Prueba enviada", "La campaña se guardó y la API respondió correctamente.");
  } catch (error) {
    feedback.error("No fue posible enviar la prueba", error);
  }
}
</script>

<template>
  <section class="page-shell page-wrap">
    <header class="page-head">
      <div>
        <p class="eyebrow">Correos masivos</p>
        <h1>Enviar correo masivo</h1>
      </div>
    </header>

    <BulkEmailCampaignForm
      :key="formKey"
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
</style>


