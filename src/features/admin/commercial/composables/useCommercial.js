import { computed, reactive, ref, toRaw } from "vue";
import { useFeedback } from "@/composables/useFeedback";
import {
  COMMERCIAL_CURRENCY_OPTIONS,
  COMMERCIAL_REQUEST_TYPE_OPTIONS,
  COMMERCIAL_STATUS_OPTIONS,
  createEmptyCommercialRecord,
  exportCommercialCsv,
  exportCommercialExcel,
  listCommercialRecords,
  removeCommercialRecord,
  saveCommercialRecord,
} from "../services/commercial.service";

function defaultFilters() {
  return {
    customer: "",
    company: "",
    email: "",
    phone: "",
    route: "",
    origin: "",
    destination: "",
    provider: "",
    aircraft: "",
    status: "all",
    currency: "all",
    date: "",
    minPrice: "",
    maxPrice: "",
    executive: "",
    requestType: "all",
  };
}

export function useCommercial() {
  const feedback = useFeedback();
  const rows = ref([]);
  const loading = ref(false);
  const saving = ref(false);
  const exporting = ref(false);
  const error = ref("");
  const source = ref("local");
  const drawerOpen = ref(false);
  const drawerMode = ref("view");
  const selectedRecord = ref(null);
  const previewRecord = ref(null);
  const filters = reactive(defaultFilters());

  const statusOptions = COMMERCIAL_STATUS_OPTIONS;
  const currencyOptions = COMMERCIAL_CURRENCY_OPTIONS;
  const requestTypeOptions = COMMERCIAL_REQUEST_TYPE_OPTIONS;

  function clonePlain(value) {
    const source = value ? toRaw(value) : null;
    return source ? JSON.parse(JSON.stringify(source)) : source;
  }

  const stats = computed(() => {
    const dataset = rows.value;
    const countByStatus = (status) => dataset.filter((row) => row.status === status).length;
    const countStatuses = (statuses) => dataset.filter((row) => statuses.includes(row.status)).length;

    return {
      total: dataset.length,
      open: countStatuses(["pendiente", "contactado", "cotizando", "cotizado", "enviada cliente"]),
      providerPending: countByStatus("solicitada proveedor"),
      negotiation: countByStatus("en negociacion"),
      accepted: countStatuses(["aceptada", "ganada"]),
      lost: countStatuses(["no aceptada", "perdida", "cancelada"]),
      sold: countStatuses(["facturada", "pagada"]),
      potentialRevenue: dataset.reduce((sum, row) => sum + Number(row.potentialRevenue || row.salePrice || 0), 0),
      confirmedRevenue: dataset.reduce((sum, row) => sum + Number(row.confirmedRevenue || 0), 0),
      expectedProfit: dataset.reduce((sum, row) => sum + Number(row.expectedProfit || row.profit || 0), 0),
    };
  });

  const summary = computed(() => ({
    activePipelineValue: rows.value
      .filter((row) => !["no aceptada", "perdida", "cancelada"].includes(row.status))
      .reduce((sum, row) => sum + Number(row.salePrice || row.potentialRevenue || 0), 0),
    followUpToday: rows.value.filter((row) => row.nextFollowUp === new Date().toISOString().slice(0, 10)).length,
    averageMargin: rows.value.length
      ? Number((rows.value.reduce((sum, row) => sum + Number(row.margin || 0), 0) / rows.value.length).toFixed(2))
      : 0,
    conversionRate: rows.value.length
      ? Number((((stats.value.accepted + stats.value.sold) / rows.value.length) * 100).toFixed(1))
      : 0,
    monthlyRevenue: rows.value
      .filter((row) => String(row.createdAt || "").slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((sum, row) => sum + Number(row.confirmedRevenue || 0), 0),
  }));

  async function refresh() {
    if (loading.value) return;
    loading.value = true;
    error.value = "";

    try {
      const response = await listCommercialRecords(filters);
      rows.value = response.rows;
      source.value = response.source;
      if (!previewRecord.value || !response.rows.some((row) => row.id === previewRecord.value?.id)) {
        previewRecord.value = response.rows[0] || null;
      } else {
        previewRecord.value = response.rows.find((row) => row.id === previewRecord.value?.id) || previewRecord.value;
      }
    } catch (loadError) {
      console.error("[Commercial] Error loading opportunities", loadError);
      error.value = "No se pudo cargar el seguimiento comercial. Verifica la conexión e intenta nuevamente.";
    } finally {
      loading.value = false;
    }
  }

  function updateFilter(key, value) {
    filters[key] = value;
  }

  function resetFilters() {
    Object.assign(filters, defaultFilters());
  }

  function openCreateQuote() {
    drawerMode.value = "create";
    selectedRecord.value = createEmptyCommercialRecord({
      requestType: "Vuelo chárter",
      timeline: [
        {
          id: `tl-${Date.now()}`,
          title: "Cotización creada",
          detail: "Se abrió una nueva cotización desde el Centro Comercial.",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    drawerOpen.value = true;
  }

  function openCreateOpportunity() {
    drawerMode.value = "create";
    selectedRecord.value = createEmptyCommercialRecord({
      requestType: "Oportunidad corporativa",
      status: "abierta",
    });
    drawerOpen.value = true;
  }

  function openView(row) {
    drawerMode.value = "view";
    selectedRecord.value = clonePlain(row);
    previewRecord.value = clonePlain(row);
    drawerOpen.value = true;
  }

  function openEdit(row) {
    drawerMode.value = "edit";
    selectedRecord.value = clonePlain(row);
    previewRecord.value = clonePlain(row);
    drawerOpen.value = true;
  }

  function selectPreview(row) {
    previewRecord.value = clonePlain(row);
  }

  function closeDrawer() {
    drawerOpen.value = false;
  }

  async function persistRecord(record, mode = drawerMode.value) {
    saving.value = true;

    try {
      const response = await saveCommercialRecord({
        ...record,
        timeline: [
          {
            id: `tl-${Date.now()}`,
            title: mode === "create" ? "Registro guardado" : "Registro actualizado",
            detail:
              mode === "create"
                ? "Se incorporó al pipeline comercial."
                : "Se actualizaron los datos operativos y comerciales.",
            createdAt: new Date().toISOString(),
          },
          ...(Array.isArray(record.timeline) ? record.timeline : []),
        ],
      });

      source.value = response.source;
      await refresh();
      selectedRecord.value = response.row;
      previewRecord.value = response.row;
      drawerMode.value = "view";
      feedback.notify(mode === "create" ? "Registro creado" : "Registro actualizado");
      closeDrawer();
      return response.row;
    } catch (saveError) {
      console.error("[Commercial] Error saving opportunity", saveError);
      await feedback.error(
        "No fue posible guardar el registro",
        null,
        "Verifica los datos e intenta nuevamente.",
      );
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function removeRow(row) {
    const result = await feedback.confirm({
      title: "Eliminar oportunidad",
      text: `¿Deseas archivar la oportunidad ${row.folio || row.customerName}?`,
      confirmButtonText: "Archivar",
      cancelButtonText: "Cancelar",
      icon: "warning",
      confirmButtonColor: "#b91c1c",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await removeCommercialRecord(row.id);
      source.value = response.source;
      await refresh();
      if (selectedRecord.value?.id === row.id) {
        closeDrawer();
      }
      if (previewRecord.value?.id === row.id) {
        previewRecord.value = rows.value[0] || null;
      }
      feedback.notify("Oportunidad archivada");
    } catch (deleteError) {
      feedback.error("No fue posible eliminar el registro", deleteError);
    }
  }

  async function duplicateRow(row) {
    const clone = createEmptyCommercialRecord({
      ...clonePlain(row),
      id: undefined,
      folio: "",
      status: "abierta",
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
      confirmedRevenue: 0,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          title: "Registro duplicado",
          detail: `Duplicado a partir de ${row.folio}.`,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    await persistRecord(clone, "create");
  }

  async function changeStatus(row, status) {
    await persistRecord(
      {
        ...row,
        status,
        confirmedRevenue:
          status === "aceptada" || status === "vuelo vendido"
            ? Number(row.salePrice || row.confirmedRevenue || 0)
            : Number(row.confirmedRevenue || 0),
      },
      "edit",
    );
  }

  async function addFollowUp(detail) {
    if (!selectedRecord.value || !detail?.trim()) {
      return;
    }

    try {
      const timestamp = new Date().toLocaleString("es-MX");
      const current = String(selectedRecord.value.observaciones || "").trim();
      const entry = `[${timestamp}] Seguimiento: ${detail.trim()}`;
      const saved = await persistRecord({
        ...selectedRecord.value,
        observaciones: current ? `${current}\n${entry}` : entry,
      }, "edit");
      if (!saved) return;
      feedback.notify("Seguimiento registrado");
    } catch (followUpError) {
      console.error("[Commercial] Error creating follow-up", followUpError);
      await feedback.error("No fue posible registrar el seguimiento");
    }
  }

  async function addNote(noteText) {
    if (!selectedRecord.value || !noteText?.trim()) {
      return;
    }

    try {
      const timestamp = new Date().toLocaleString("es-MX");
      const current = String(selectedRecord.value.observaciones || "").trim();
      const entry = `[${timestamp}] Nota: ${noteText.trim()}`;
      const saved = await persistRecord({
        ...selectedRecord.value,
        observaciones: current ? `${current}\n${entry}` : entry,
      }, "edit");
      if (!saved) return;
      feedback.notify("Nota agregada");
    } catch (noteError) {
      console.error("[Commercial] Error creating note", noteError);
      await feedback.error("No fue posible agregar la nota");
    }
  }

  async function addAttachment(file) {
    if (!selectedRecord.value || !file) {
      return;
    }

    feedback.warning("Archivos no disponibles", "La tabla principal no contiene almacenamiento de archivos.");
  }

  async function removeAttachment(attachmentId) {
    if (!selectedRecord.value) return;

    void attachmentId;
  }

  async function exportCsv() {
    exporting.value = true;
    try {
      exportCommercialCsv(rows.value);
      feedback.notify("CSV exportado");
    } finally {
      exporting.value = false;
    }
  }

  async function exportExcel() {
    exporting.value = true;
    try {
      exportCommercialExcel(rows.value);
      feedback.notify("Excel exportado");
    } finally {
      exporting.value = false;
    }
  }

  function generatePdf(row) {
    feedback.warning("PDF pendiente", `La ficha PDF para ${row.folio} quedó preparada para integración.`);
  }

  function sendEmail(row) {
    feedback.warning("Correo pendiente", `Conecta aquí tu flujo de email para ${row.email || row.customerName}.`);
  }

  return {
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
    previewRecord,
    selectedRecord,
    selectPreview,
    source,
    stats,
    statusOptions,
    summary,
    addAttachment,
    addFollowUp,
    addNote,
    changeStatus,
    closeDrawer,
    duplicateRow,
    exportCsv,
    exportExcel,
    generatePdf,
    openCreateOpportunity,
    openCreateQuote,
    openEdit,
    openView,
    persistRecord,
    refresh,
    removeAttachment,
    removeRow,
    resetFilters,
    sendEmail,
    updateFilter,
  };
}
