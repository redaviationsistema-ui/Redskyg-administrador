import { computed, onBeforeUnmount, ref, watch } from "vue";
import { getCampaignProgress } from "../services/bulkEmailApi.service";

const ACTIVE_STATUSES = new Set(["processing", "in_progress", "sending", "running"]);

export function useBulkEmailProgress(statusRef, campaignIdRef) {
  const progress = ref(null);
  const loading = ref(false);
  const error = ref("");
  let timerId = null;

  const isActive = computed(() => ACTIVE_STATUSES.has(String(statusRef?.value || "").toLowerCase()) && Boolean(campaignIdRef?.value));

  function stop() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  async function refresh() {
    if (!campaignIdRef?.value) {
      return;
    }

    loading.value = true;
    error.value = "";

    try {
      progress.value = await getCampaignProgress(campaignIdRef.value);

      const resolvedStatus = String(
        progress.value?.status ||
          progress.value?.campaign?.status ||
          statusRef?.value ||
          "",
      ).toLowerCase();

      if (!ACTIVE_STATUSES.has(resolvedStatus)) {
        stop();
      }
    } catch (err) {
      error.value = err?.message || "No fue posible consultar el progreso.";
      stop();
    } finally {
      loading.value = false;
    }
  }

  function start() {
    stop();
    refresh();
    timerId = window.setInterval(refresh, 15000);
  }

  watch(
    isActive,
    (active) => {
      if (active) {
        start();
      } else {
        stop();
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(stop);

  return {
    progress,
    loading,
    error,
    refresh,
    stop,
  };
}
