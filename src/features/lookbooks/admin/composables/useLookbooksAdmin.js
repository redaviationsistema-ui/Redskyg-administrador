import { computed, reactive, ref, watch } from "vue";
import { useFeedback } from "@/composables/useFeedback";
import {
  createLookbook,
  createPdfSignedUrl,
  deleteLookbook,
  formatFileSizeInMb,
  getLookbookDownloadsPage,
  getLookbooksPage,
  getLookbooksStats,
  removeCoverFile,
  removePdfFile,
  slugifyLookbook,
  updateLookbook,
  updateLookbookStatus,
  uploadCoverFile,
  uploadPdfFile,
} from "../services/lookbooksAdmin.service";

function getErrorMessage(error, fallback) {
  return error?.message || error?.details || fallback;
}

export function useLookbooksAdmin() {
  const feedback = useFeedback();

  const filters = reactive({
    search: "",
    category: "all",
    status: "all",
    access: "all",
    order: "manual_asc",
  });

  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  const downloadsPagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
  });

  const stats = reactive({
    total: 0,
    active: 0,
    inactive: 0,
    protected: 0,
    downloads: 0,
  });

  const state = reactive({
    loading: false,
    refreshing: false,
    statsLoading: false,
    saving: false,
    deleting: false,
    toggling: false,
    error: "",
  });

  const uploadState = reactive({
    stage: "idle",
    coverProgress: 0,
    pdfProgress: 0,
    coverStatus: "",
    pdfStatus: "",
  });

  const lookbooks = ref([]);
  const downloadsRows = ref([]);
  const downloadsLoading = ref(false);
  const downloadsError = ref("");
  const downloadsTarget = ref(null);
  const rowAction = reactive({
    id: null,
    type: "",
  });

  const totalPages = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)));
  const downloadsPages = computed(() => Math.max(1, Math.ceil(downloadsPagination.total / downloadsPagination.pageSize)));
  const hasActiveFilters = computed(
    () =>
      Boolean(filters.search) ||
      filters.category !== "all" ||
      filters.status !== "all" ||
      filters.access !== "all" ||
      filters.order !== "manual_asc",
  );

  function resetUploads() {
    uploadState.stage = "idle";
    uploadState.coverProgress = 0;
    uploadState.pdfProgress = 0;
    uploadState.coverStatus = "";
    uploadState.pdfStatus = "";
  }

  async function loadStats() {
    state.statsLoading = true;
    try {
      const response = await getLookbooksStats();
      Object.assign(stats, response);
    } finally {
      state.statsLoading = false;
    }
  }

  async function loadLookbooks({ silent = false } = {}) {
    if (!silent) {
      state.loading = true;
      state.error = "";
    } else {
      state.refreshing = true;
    }

    try {
      const response = await getLookbooksPage({
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters,
      });

      lookbooks.value = response.rows;
      pagination.total = response.total;
    } catch (error) {
      state.error = getErrorMessage(error, "No fue posible cargar los lookbooks.");
      lookbooks.value = [];
      pagination.total = 0;
      throw error;
    } finally {
      state.loading = false;
      state.refreshing = false;
    }
  }

  async function refreshData(options = {}) {
    await Promise.all([loadStats(), loadLookbooks(options)]);
  }

  async function submitLookbook({ mode, lookbookId, values, files }) {
    state.saving = true;
    resetUploads();
    uploadState.stage = "subiendo_archivos";

    const slug = slugifyLookbook(values.slug || values.title);
    const payload = {
      title: values.title,
      slug,
      description: values.description || "",
      aircraft_name: values.aircraft_name || "",
      category: values.category || "",
      cover_url: values.current_cover_url || "",
      pdf_path: values.current_pdf_path || "",
      pages: values.pages === "" || values.pages === null ? null : Number(values.pages),
      size_mb: values.size_mb === "" || values.size_mb === null ? null : Number(values.size_mb),
      is_active: Boolean(values.is_active),
      requires_login: Boolean(values.requires_login),
      order_index: values.order_index === "" || values.order_index === null ? null : Number(values.order_index),
    };

    let uploadedCoverUrl = "";
    let uploadedPdfPath = "";
    let replacedCoverUrl = "";
    let replacedPdfPath = "";

    try {
      if (files.coverFile) {
        uploadState.coverStatus = "Subiendo portada...";
        const coverUpload = await uploadCoverFile({
          file: files.coverFile,
          slug,
          onProgress: (progress) => {
            uploadState.coverProgress = progress;
          },
        });
        uploadedCoverUrl = coverUpload.publicUrl;
        payload.cover_url = coverUpload.publicUrl;
      }

      if (files.pdfFile) {
        uploadState.pdfStatus = "Subiendo PDF...";
        const pdfPath = await uploadPdfFile({
          file: files.pdfFile,
          slug,
          onProgress: (progress) => {
            uploadState.pdfProgress = progress;
          },
        });
        uploadedPdfPath = pdfPath;
        payload.pdf_path = pdfPath;
        payload.size_mb = formatFileSizeInMb(files.pdfFile.size);
      }

      uploadState.stage = "guardando";

      if (mode === "create") {
        await createLookbook(payload);
      } else {
        replacedCoverUrl = files.coverFile ? values.current_cover_url || "" : "";
        replacedPdfPath = files.pdfFile ? values.current_pdf_path || "" : "";
        await updateLookbook(lookbookId, payload);
      }

      uploadState.stage = "finalizando";

      if (replacedCoverUrl) {
        await removeCoverFile(replacedCoverUrl);
      }

      if (replacedPdfPath) {
        await removePdfFile(replacedPdfPath);
      }

      await refreshData({ silent: true });
      feedback.success(
        mode === "create" ? "Lookbook creado" : "Lookbook actualizado",
        mode === "create"
          ? "El registro y sus archivos fueron guardados correctamente."
          : "Los cambios se aplicaron correctamente.",
      );
    } catch (error) {
      if (uploadedCoverUrl) {
        await removeCoverFile(uploadedCoverUrl).catch(() => {});
      }

      if (uploadedPdfPath) {
        await removePdfFile(uploadedPdfPath).catch(() => {});
      }

      throw error;
    } finally {
      state.saving = false;
      resetUploads();
    }
  }

  async function toggleStatus(item) {
    const nextStatus = !item.is_active;
    const confirmation = await feedback.confirm({
      title: nextStatus ? "Activar lookbook" : "Desactivar lookbook",
      text: nextStatus
        ? `Se activará "${item.title}".`
        : `Se desactivará "${item.title}" y dejará de mostrarse como activo.`,
      confirmButtonText: nextStatus ? "Activar" : "Desactivar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: nextStatus ? "#15803d" : "#d97706",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    state.toggling = true;
    rowAction.id = item.id;
    rowAction.type = "toggle";

    try {
      await updateLookbookStatus(item.id, nextStatus);
      await refreshData({ silent: true });
      feedback.notify(nextStatus ? "Lookbook activado" : "Lookbook desactivado");
    } catch (error) {
      feedback.error("No fue posible actualizar el estado", error);
    } finally {
      state.toggling = false;
      rowAction.id = null;
      rowAction.type = "";
    }
  }

  async function removeLookbook(item) {
    const confirmation = await feedback.confirm({
      title: "Eliminar lookbook",
      text: `Se eliminarán el registro y sus archivos de Storage para "${item.title}".`,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      icon: "warning",
      confirmButtonColor: "#c62828",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    state.deleting = true;
    rowAction.id = item.id;
    rowAction.type = "delete";

    try {
      await removeCoverFile(item.cover_url || "");
      await removePdfFile(item.pdf_path || "");
      await deleteLookbook(item.id);

      if (lookbooks.value.length === 1 && pagination.page > 1) {
        pagination.page -= 1;
      }

      await refreshData({ silent: true });
      feedback.notify("Lookbook eliminado");
    } catch (error) {
      feedback.error("No fue posible eliminar el lookbook", error);
    } finally {
      state.deleting = false;
      rowAction.id = null;
      rowAction.type = "";
    }
  }

  async function openDownloads(item) {
    downloadsTarget.value = item;
    downloadsPagination.page = 1;
    await loadDownloads();
  }

  async function loadDownloads() {
    if (!downloadsTarget.value?.id) {
      return;
    }

    downloadsLoading.value = true;
    downloadsError.value = "";

    try {
      const response = await getLookbookDownloadsPage({
        lookbookId: downloadsTarget.value.id,
        page: downloadsPagination.page,
        pageSize: downloadsPagination.pageSize,
      });

      downloadsRows.value = response.rows;
      downloadsPagination.total = response.total;
    } catch (error) {
      downloadsError.value = getErrorMessage(error, "No fue posible cargar el historial de descargas.");
      downloadsRows.value = [];
      downloadsPagination.total = 0;
    } finally {
      downloadsLoading.value = false;
    }
  }

  function closeDownloads() {
    downloadsTarget.value = null;
    downloadsRows.value = [];
    downloadsError.value = "";
    downloadsPagination.page = 1;
    downloadsPagination.total = 0;
  }

  async function previewLookbook(item) {
    rowAction.id = item.id;
    rowAction.type = "preview";

    try {
      const signedUrl = await createPdfSignedUrl(item.pdf_path);
      if (!signedUrl) {
        throw new Error("No se encontró un PDF asociado a este lookbook.");
      }

      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      feedback.error("No fue posible abrir el lookbook", error);
    } finally {
      rowAction.id = null;
      rowAction.type = "";
    }
  }

  function setPage(page) {
    pagination.page = Math.min(Math.max(1, page), totalPages.value);
  }

  function setDownloadsPage(page) {
    downloadsPagination.page = Math.min(Math.max(1, page), downloadsPages.value);
  }

  function resetFilters() {
    filters.search = "";
    filters.category = "all";
    filters.status = "all";
    filters.access = "all";
    filters.order = "manual_asc";
    pagination.page = 1;
  }

  watch(
    () => [filters.search, filters.category, filters.status, filters.access, filters.order],
    () => {
      pagination.page = 1;
    },
  );

  watch(
    () => pagination.page,
    async () => {
      await loadLookbooks({ silent: true }).catch(() => {});
    },
  );

  watch(
    () => [filters.search, filters.category, filters.status, filters.access, filters.order],
    async () => {
      await loadLookbooks({ silent: true }).catch(() => {});
    },
  );

  watch(
    () => downloadsPagination.page,
    async () => {
      if (downloadsTarget.value) {
        await loadDownloads();
      }
    },
  );

  async function initialize() {
    state.loading = true;
    state.error = "";

    try {
      await Promise.all([loadStats(), loadLookbooks()]);
    } catch (error) {
      state.error = getErrorMessage(error, "No fue posible iniciar el módulo de lookbooks.");
    } finally {
      state.loading = false;
    }
  }

  return {
    downloadsError,
    downloadsLoading,
    downloadsPages,
    downloadsPagination,
    downloadsRows,
    downloadsTarget,
    filters,
    hasActiveFilters,
    initialize,
    loadDownloads,
    lookbooks,
    openDownloads,
    pagination,
    previewLookbook,
    refreshData,
    removeLookbook,
    resetFilters,
    rowAction,
    setDownloadsPage,
    setPage,
    state,
    stats,
    submitLookbook,
    toggleStatus,
    totalPages,
    uploadState,
    closeDownloads,
  };
}
