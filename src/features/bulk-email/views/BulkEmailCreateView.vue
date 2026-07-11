<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import { useFeedback } from "@/composables/useFeedback";
import BulkEmailCampaignForm from "../components/BulkEmailCampaignForm.vue";
import { createCampaign, updateCampaign } from "../services/bulkEmail.service";
import { sendTestCampaign, startAndProcessCampaign } from "../services/bulkEmailApi.service";
import { buildBulkEmailApiPayload } from "../utils/bulkEmailTemplate";

const router = useRouter();
const feedback = useFeedback();
const campaign = ref(null);
const saving = ref(false);

async function persistCampaign(values) {
  saving.value = true;

  try {
    const savedCampaign = campaign.value?.id
      ? await updateCampaign(campaign.value.id, values)
      : await createCampaign(values);

    campaign.value = savedCampaign;
    await router.replace(`/correos-masivos/${savedCampaign.id}/editar`);
    return savedCampaign;
  } finally {
    saving.value = false;
  }
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
  let campaign = null;

  try {
    campaign = await persistCampaign(values);
    await startAndProcessCampaign(campaign.id, buildBulkEmailApiPayload(values));
    feedback.success("Campaña iniciada", "La API confirmó el inicio y procesamiento del envío.");
    router.push(`/correos-masivos/${campaign.id}`);
  } catch (error) {
    if (campaign?.id) {
      feedback.warning(
        "Campaña guardada pero no iniciada",
        "Se creó el borrador, pero la API no confirmó el envío. Revisa la conexión con Inventory y vuelve a intentarlo.",
      );
      router.push(`/correos-masivos/${campaign.id}/editar`);
      return;
    }
    feedback.error("No fue posible iniciar la campaña", error);
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
        <p class="eyebrow">Marketing communication</p>
        <h1>Nueva campaña</h1>
      </div>
      <BaseButton variant="secondary" @click="router.push('/correos-masivos')">Volver</BaseButton>
    </header>

    <BulkEmailCampaignForm
      :campaign="campaign"
      :saving="saving"
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
