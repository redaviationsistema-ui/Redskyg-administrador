import { computed, reactive, ref } from "vue";
import { useFeedback } from "@/composables/useFeedback";
import {
  cancelCampaign,
  pauseCampaign,
  processCampaign,
  resumeCampaign,
  sendCampaignToAll,
  sendTestCampaign,
} from "../services/bulkEmailApi.service";
import { buildBulkEmailApiPayload } from "../utils/bulkEmailTemplate";
import {
  deleteCampaign,
  duplicateCampaign,
  ensureCampaignRecipientCount,
  getCampaignById,
  getCampaignDeliveries,
  getCampaignStats,
  getCampaigns,
} from "../services/bulkEmail.service";

export function useBulkEmailCampaigns() {
  const feedback = useFeedback();
  const campaigns = ref([]);
  const stats = reactive({
    totalCampaigns: 0,
    drafts: 0,
    scheduled: 0,
    processing: 0,
    completed: 0,
    sent: 0,
    failed: 0,
    cancellations: 0,
  });
  const filters = reactive({
    search: "",
    status: "all",
    startDate: "",
    endDate: "",
  });
  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
  });
  const state = reactive({
    loading: false,
    refreshing: false,
    deletingId: null,
    actionId: null,
    actionType: "",
    error: "",
    warning: "",
  });

  const deliveries = ref([]);
  const deliveriesState = reactive({
    loading: false,
    error: "",
    page: 1,
    pageSize: 10,
    total: 0,
  });

  const totalPages = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)));
  const deliveryPages = computed(() => Math.max(1, Math.ceil(deliveriesState.total / deliveriesState.pageSize)));

  async function loadStats() {
    try {
      const response = await getCampaignStats();
      Object.assign(stats, response);
      state.warning = "";
    } catch (err) {
      Object.assign(stats, {
        totalCampaigns: 0,
        drafts: 0,
        scheduled: 0,
        processing: 0,
        completed: 0,
        sent: 0,
        failed: 0,
        cancellations: 0,
      });
      state.warning = err?.message || "No fue posible cargar las métricas.";
    }
  }

  async function loadCampaigns({ silent = false } = {}) {
    if (silent) {
      state.refreshing = true;
    } else {
      state.loading = true;
      state.error = "";
    }

    try {
      const response = await getCampaigns({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters,
      });
      campaigns.value = response.rows;
      pagination.total = response.total;
    } catch (err) {
      state.error = err?.message || "No fue posible cargar campañas.";
      campaigns.value = [];
      pagination.total = 0;
    } finally {
      state.loading = false;
      state.refreshing = false;
    }
  }

  async function refreshAll({ silent = false } = {}) {
    await Promise.allSettled([loadStats(), loadCampaigns({ silent })]);
  }

  function resetFilters() {
    filters.search = "";
    filters.status = "all";
    filters.startDate = "";
    filters.endDate = "";
    pagination.page = 1;
  }

  async function confirmAndDelete(campaign) {
    const result = await feedback.confirm({
      title: "Eliminar campaña",
      text: `Se eliminará "${campaign.subject}". Esta acción no se puede deshacer.`,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      icon: "warning",
      confirmButtonColor: "#c62828",
    });

    if (!result.isConfirmed) {
      return;
    }

    state.deletingId = campaign.id;
    try {
      await deleteCampaign(campaign.id);
      await refreshAll({ silent: true });
      feedback.notify("Campaña eliminada");
    } catch (err) {
      feedback.error("No fue posible eliminar la campaña", err);
    } finally {
      state.deletingId = null;
    }
  }

  async function duplicate(campaign) {
    state.actionId = campaign.id;
    state.actionType = "duplicate";
    try {
      const cloned = await duplicateCampaign(campaign.id);
      await refreshAll({ silent: true });
      feedback.success("Campaña duplicada", `Se creó la copia #${cloned.id}.`);
      return cloned;
    } catch (err) {
      feedback.error("No fue posible duplicar la campaña", err);
      return null;
    } finally {
      state.actionId = null;
      state.actionType = "";
    }
  }

  async function performApiAction({ campaign, type, confirmConfig, action }) {
    if (confirmConfig) {
      const result = await feedback.confirm(confirmConfig);
      if (!result.isConfirmed) {
        return null;
      }
    }

    state.actionId = campaign.id;
    state.actionType = type;

    try {
      const response = await action();
      await refreshAll({ silent: true });
      return response;
    } catch (err) {
      feedback.error("No fue posible completar la operación", err);
      return null;
    } finally {
      state.actionId = null;
      state.actionType = "";
    }
  }

  function sendTest(campaign, email) {
    return performApiAction({
      campaign,
      type: "send_test",
      action: () => sendTestCampaign(campaign.id, email, buildBulkEmailApiPayload(campaign)),
    });
  }

  function start(campaign) {
    return performApiAction({
      campaign,
      type: "start",
      confirmConfig: {
        title: "Enviar a todos",
        text: `Se enviara un correo individual a los destinatarios pendientes de "${campaign.subject}".`,
        confirmButtonText: "Enviar a todos",
        cancelButtonText: "Cancelar",
      },
      action: async () => {
        const freshCampaign = await ensureCampaignRecipientCount(campaign.id);

        if (!Number(freshCampaign?.total_recipients || 0)) {
          throw new Error("La campaña no tiene destinatarios guardados. Importa y confirma al menos un destinatario antes de iniciar el envío.");
        }

        return sendCampaignToAll(campaign.id, buildBulkEmailApiPayload(freshCampaign));
      },
    });
  }

  function pause(campaign) {
    return performApiAction({
      campaign,
      type: "pause",
      action: () => pauseCampaign(campaign.id),
    });
  }

  function resume(campaign) {
    return performApiAction({
      campaign,
      type: "resume",
      action: async () => {
        await resumeCampaign(campaign.id);
        return processCampaign(campaign.id);
      },
    });
  }

  function cancel(campaign) {
    return performApiAction({
      campaign,
      type: "cancel",
      confirmConfig: {
        title: "Cancelar campaña",
        text: `Se cancelará "${campaign.subject}".`,
        confirmButtonText: "Cancelar campaña",
        cancelButtonText: "Volver",
        icon: "warning",
      },
      action: () => cancelCampaign(campaign.id),
    });
  }

  async function loadDeliveries(campaignId) {
    deliveriesState.loading = true;
    deliveriesState.error = "";

    try {
      const response = await getCampaignDeliveries({
        campaignId,
        page: deliveriesState.page,
        pageSize: deliveriesState.pageSize,
      });
      deliveries.value = response.rows;
      deliveriesState.total = response.total;
    } catch (err) {
      deliveriesState.error = err?.message || "No fue posible cargar entregas.";
      deliveries.value = [];
      deliveriesState.total = 0;
    } finally {
      deliveriesState.loading = false;
    }
  }

  async function getById(id) {
    return getCampaignById(id);
  }

  return {
    cancel,
    campaigns,
    deliveries,
    deliveriesState,
    deliveryPages,
    duplicate,
    filters,
    getById,
    loadCampaigns,
    loadDeliveries,
    loadStats,
    pagination,
    pause,
    refreshAll,
    resetFilters,
    resume,
    sendTest,
    start,
    state,
    stats,
    totalPages,
    confirmAndDelete,
  };
}

