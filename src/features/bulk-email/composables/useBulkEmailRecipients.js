import { computed, reactive, ref } from "vue";
import { parseCsv } from "../utils/csvParser";
import { parseExcelFile } from "../utils/excelParser";
import { normalizeRecipients } from "../utils/recipientNormalizer";
import { addCampaignRecipients, checkUnsubscribedEmails, getCampaignRecipients, removeCampaignRecipient } from "../services/bulkEmail.service";

export function useBulkEmailRecipients(campaignIdRef) {
  const importedRows = ref([]);
  const importSummary = reactive({
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    automated: 0,
    unsubscribed: 0,
    ready: 0,
  });
  const recipientRows = ref([]);
  const loading = ref(false);
  const importing = ref(false);
  const error = ref("");
  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  const totalPages = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)));

  async function loadRecipients() {
    if (!campaignIdRef?.value) {
      recipientRows.value = [];
      pagination.total = 0;
      return;
    }

    loading.value = true;
    error.value = "";

    try {
      const response = await getCampaignRecipients({
        campaignId: campaignIdRef.value,
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
      recipientRows.value = response.rows;
      pagination.total = response.total;
    } catch (err) {
      error.value = err?.message || "No fue posible cargar destinatarios.";
      recipientRows.value = [];
      pagination.total = 0;
    } finally {
      loading.value = false;
    }
  }

  async function prepareRecipientsFromCsv(text) {
    const parsed = parseCsv(text);
    await prepareRecipients(parsed.records);
  }

  async function prepareRecipientsFromSpreadsheet(file) {
    const parsed = await parseExcelFile(file);
    await prepareRecipients(parsed.records);
  }

  async function prepareRecipientsFromText(text = "") {
    const inputs = String(text || "")
      .split(/\r?\n|,|;/)
      .map((item) => ({ email: item }));
    await prepareRecipients(inputs);
  }

  async function prepareRecipients(inputs = []) {
    const emails = inputs.map((item) => item.email || item.correo || "");
    const unsubscribed = await checkUnsubscribedEmails(emails);
    const normalized = normalizeRecipients(inputs, unsubscribed.map((item) => item.email));

    importedRows.value = normalized.records;
    Object.assign(importSummary, normalized.summary);
  }

  function clearImportedRows() {
    importedRows.value = [];
    Object.assign(importSummary, {
      total: 0,
      valid: 0,
      invalid: 0,
      duplicates: 0,
      automated: 0,
      unsubscribed: 0,
      ready: 0,
    });
  }

  async function confirmImport() {
    if (!campaignIdRef?.value) {
      throw new Error("Debes guardar la campaña antes de importar destinatarios.");
    }

    importing.value = true;
    error.value = "";

    try {
      const readyRows = importedRows.value.filter(
        (item) => item.isValid && !item.isDuplicate && !item.isAutomated && !item.isUnsubscribed,
      );
      await addCampaignRecipients(campaignIdRef.value, readyRows);
      clearImportedRows();
      await loadRecipients();
    } catch (err) {
      error.value = err?.message || "No fue posible importar destinatarios.";
      throw err;
    } finally {
      importing.value = false;
    }
  }

  async function deleteRecipient(recipientId) {
    await removeCampaignRecipient(recipientId);
    if (recipientRows.value.length === 1 && pagination.page > 1) {
      pagination.page -= 1;
    }
    await loadRecipients();
  }

  return {
    clearImportedRows,
    confirmImport,
    deleteRecipient,
    error,
    importSummary,
    importedRows,
    importing,
    loadRecipients,
    loading,
    pagination,
    prepareRecipients,
    prepareRecipientsFromCsv,
    prepareRecipientsFromSpreadsheet,
    prepareRecipientsFromText,
    recipientRows,
    totalPages,
  };
}
