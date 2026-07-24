<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import Swal from "sweetalert2";
import { supabaseInventory } from "../../../supabase";
import { useRoute, useRouter } from "vue-router";
import { useFeedback } from "../../../composables/useFeedback";

const router = useRouter();
const route = useRoute();
const feedback = useFeedback();

const quotes = ref([]);
const loading = ref(false);
const selectedLanguage = ref("en");
const hiddenAutoSendUrl = ref("");
const searchTerm = ref(localStorage.getItem("quotesValidationSearch") || "");
const highlightedQuoteNumber = computed(() =>
  String(route.query.highlight_quote || "").trim(),
);
const visibleQuotes = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();

  if (!term) return quotes.value;

  return quotes.value.filter((quote) => {
    const itemText = Array.isArray(quote.items)
      ? quote.items
          .map((item) =>
            [
              item.part_number,
              item.partNumber,
              item.PartNumber,
              item.description,
              item.Description,
              item.code,
            ].filter(Boolean).join(" "),
          )
          .join(" ")
      : "";

    return [
      quote.quote_number,
      quote.id,
      quote.client_contact,
      quote.client_email,
      quote.client_phone,
      quote.status,
      quote.sale_status,
      quote.validation_description,
      itemText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
});
const summaryCards = computed(() => {
  const list = quotes.value || [];

  return {
    total: list.length,
    pending: list.filter((quote) => quote.status?.toLowerCase() === "pending")
      .length,
    followUp: list.filter(
      (quote) => quote.status?.toLowerCase() === "seguimiento",
    ).length,
    validated: list.filter(
      (quote) => quote.status?.toLowerCase() === "validated",
    ).length,
  };
});

const loadQuotes = async () => {
  loading.value = true;

  try {
    const { data, error } = await supabaseInventory
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    quotes.value = data || [];
  } catch (err) {
    console.error(err);
    await feedback.error(
      "Unable to load quotes",
      err,
      "The quotes list could not be loaded.",
    );
  } finally {
  loading.value = false;
  }
};

watch(searchTerm, (value) => {
  const trimmed = value.trim();

  if (trimmed) {
    localStorage.setItem("quotesValidationSearch", value);
  } else {
    localStorage.removeItem("quotesValidationSearch");
  }
});

function clearSearch() {
  searchTerm.value = "";
}

function getRowClass(status) {
  const s = status?.toLowerCase();

  if (s === "validated") return "row-success";
  if (s === "seguimiento") return "row-warning";
  if (s === "pending") return "row-danger";

  return "row-default";
}

function isHighlightedQuote(quote) {
  return (
    highlightedQuoteNumber.value &&
    String(quote.quote_number || "").trim() === highlightedQuoteNumber.value
  );
}

function getStatusLabel(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  const statusLabels = {
    validated: "Validated",
    seguimiento: "Seguimiento",
    pending: "Pending",
    activo: "Activo",
    cerrado: "Cerrado",
    perdido: "Perdido",
  };

  return statusLabels[normalizedStatus] || String(status || "").trim() || "Undefined";
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSaleStatus(value) {
  if (value === "vendio") return "Vendio";
  if (value === "no_vendio") return "No vendio";
  return "Sin dato";
}

function getFollowUpEntries(quote) {
  return String(quote.validation_description || "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("[") && entry.includes("Seguimiento enviado por"));
}

function getDescriptionNotes(quote) {
  const notes = String(quote.validation_description || "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(
      (entry) =>
        entry &&
        !(entry.startsWith("[") && entry.includes("Seguimiento enviado por")),
    );

  return notes.join("\n");
}

function getLatestFollowUpEntry(quote) {
  const entries = getFollowUpEntries(quote);
  return entries.at(-1) || "";
}

function getLatestFollowUpChannel(quote) {
  const latestEntry = getLatestFollowUpEntry(quote);

  if (latestEntry.includes("WhatsApp")) return "WhatsApp";
  if (latestEntry.includes("Llamada")) return "Llamada";
  if (latestEntry.includes("Correo")) return "Correo";

  return "";
}

function getChannelClass(channel) {
  if (channel === "WhatsApp") return "channel-whatsapp";
  if (channel === "Llamada") return "channel-call";
  if (channel === "Correo") return "channel-mail";
  return "channel-default";
}

function getItemSummary(quote) {
  const items = Array.isArray(quote.items) ? quote.items : [];

  if (!items.length) {
    return "la pieza cotizada";
  }

  const parts = items
    .map((item) => item.part_number || item.description || item.code)
    .filter(Boolean)
    .slice(0, 3);

  if (!parts.length) {
    return "la pieza cotizada";
  }

  return parts.join(", ");
}

function getPartNumbers(quote) {
  const items = Array.isArray(quote.items) ? quote.items : [];

  return [
    ...new Set(
      items
        .map(
          (item) =>
            item.part_number ||
            item.partNumber ||
            item.PartNumber ||
            item.partnumber ||
            item.PARTNUMBER,
        )
        .filter((value) => String(value || "").trim() !== "")
        .map((value) => String(value).trim()),
    ),
  ];
}

function getItemDescriptions(quote) {
  const items = Array.isArray(quote.items) ? quote.items : [];

  return [
    ...new Set(
      items
        .map(
          (item) =>
            item.description ||
            item.Description ||
            item.DESCRIPTION,
        )
        .filter((value) => String(value || "").trim() !== "")
        .map((value) => String(value).trim()),
    ),
  ];
}

function getVisibleItemDescriptions(quote) {
  return getItemDescriptions(quote).slice(0, 2);
}

function getHiddenItemDescriptionsCount(quote) {
  return Math.max(getItemDescriptions(quote).length - 2, 0);
}

function getVisiblePartNumbers(quote) {
  return getPartNumbers(quote).slice(0, 2);
}

function getHiddenPartNumbersCount(quote) {
  return Math.max(getPartNumbers(quote).length - 2, 0);
}

function getProfessionalMessage(quote, language = "es") {
  const contact = quote.client_contact || "Customer";
  const pieceSummary = getItemSummary(quote);
  const quoteNumber = quote.quote_number || "-";

  if (language === "en") {
    return [
      `Dear ${contact},`,
      "",
      `I hope you are doing well. I am writing to follow up on quotation ${quoteNumber} regarding ${pieceSummary}.`,
      "I would appreciate the opportunity to know whether you require any additional information, technical clarification, or commercial support to move forward.",
      "Please feel free to share any comments or updates at your convenience.",
      "For further information, you may also contact us directly at +5215586186576.",
      "https://wa.me/+5215586186576",
      "",
      "We remain fully available to assist you.",
      "",
      "Best regards,",
    ].join("\n");
  }

  return [
    `Estimado/a ${contact},`,
    "",
    `Espero se encuentre muy bien. Me permito dar seguimiento a la cotizacion ${quoteNumber}, correspondiente a ${pieceSummary}.`,
    "Agradeceremos nos comparta cualquier comentario, actualizacion o informacion adicional que requiera para continuar con el proceso.",
    "Quedamos a su disposicion para brindar soporte comercial o tecnico en lo que sea necesario.",
      "",
      "Saludos cordiales,",
    ].join("\n");
}

function buildFollowUpMessage(quote) {
  return getProfessionalMessage(quote, selectedLanguage.value);
}

function sanitizePhoneNumber(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function buildFollowUpLogEntry(channel) {
  const timestamp = new Date().toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `[${timestamp}] Seguimiento enviado por ${channel}`;
}

async function registerFollowUpAction(quote, channel) {
  const currentDescription = String(quote.validation_description || "").trim();
  const logEntry = buildFollowUpLogEntry(channel);
  const nextDescription = currentDescription
    ? `${currentDescription}\n${logEntry}`
    : logEntry;

  const { error } = await supabaseInventory
    .from("quotes")
    .update({
      status: "seguimiento",
      sent_at: new Date().toISOString(),
      validation_description: nextDescription,
    })
    .eq("id", quote.id);

  if (error) throw error;

  quote.status = "seguimiento";
  quote.sent_at = new Date().toISOString();
  quote.validation_description = nextDescription;
}

async function markQuoteAsFollowUp(quote) {
  const sentAt = new Date().toISOString();

  const { error } = await supabaseInventory
    .from("quotes")
    .update({
      status: "seguimiento",
      sent_at: sentAt,
    })
    .eq("id", quote.id);

  if (error) throw error;

  quote.status = "seguimiento";
  quote.sent_at = sentAt;
}

async function openWhatsAppFollowUp(quote) {
  const phone = sanitizePhoneNumber(quote.client_phone);

  if (!phone) {
    feedback.notify("Esta cotizacion no tiene telefono del cliente.", "warning");
    return;
  }

  try {
    await registerFollowUpAction(quote, "WhatsApp");

    const message = encodeURIComponent(buildFollowUpMessage(quote));
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener");
  } catch (err) {
    console.error(err);
    await feedback.error(
      "No se pudo registrar el seguimiento",
      err,
      "La accion de WhatsApp no pudo guardarse en la base de datos.",
    );
  }
}

async function openCallFollowUp(quote) {
  const phone = sanitizePhoneNumber(quote.client_phone);

  if (!phone) {
    feedback.notify("Esta cotizacion no tiene telefono del cliente.", "warning");
    return;
  }

  try {
    await registerFollowUpAction(quote, "Llamada");
    window.location.href = `tel:${phone}`;
  } catch (err) {
    console.error(err);
    await feedback.error(
      "No se pudo registrar el seguimiento",
      err,
      "La accion de llamada no pudo guardarse en la base de datos.",
    );
  }
}

async function openEmailFollowUp(quote) {
  try {
    const emailSubject =
      selectedLanguage.value === "en"
        ? `Follow-up on quotation ${quote.quote_number || ""}`
        : `Seguimiento de cotizacion ${quote.quote_number || ""}`;
    const emailBody = buildFollowUpMessage(quote);

    const target = router.resolve({
      name: "InventoryPdf",
      query: {
        quote_number: quote.quote_number,
        autoSend: "true",
        autoSendMode: "v2",
        emailSubject,
        emailBody,
      },
    });

    hiddenAutoSendUrl.value = "";
    hiddenAutoSendUrl.value = `${target.href}${target.href.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
    feedback.notify(`Reenviando PDF de la cotizacion ${quote.quote_number}...`, "info");
  } catch (err) {
    console.error(err);
    await feedback.error(
      "No se pudo registrar el correo",
      err,
      "La accion de correo no pudo guardarse o abrirse.",
    );
  }
}

const validateFinal = async (quote) => {
  const result = await Swal.fire({
    title: "Finalize Quote Validation",
    html: `
      <div class="validation-form">
        <div class="validation-hero">
          <span class="validation-kicker">Final Review</span>
          <div class="validation-quote-number">${quote.quote_number}</div>
          <p class="validation-helper">
            Confirm the business outcome and save a short internal summary for this quote.
          </p>
        </div>

        <label for="validation-description" class="swal-label">Validation notes</label>
        <textarea
          id="validation-description"
          class="swal2-textarea validation-textarea"
          placeholder="Add a brief summary of the outcome, customer response or relevant internal notes"
        ></textarea>

        <label for="sale-status" class="swal-label">Estatus comercial</label>
        <select id="sale-status" class="swal2-select validation-select">
          <option value="">Selecciona el estatus</option>
          <option value="activo">Activo</option>
          <option value="cerrado">Cerrado</option>
          <option value="perdido">Perdido</option>
        </select>
      </div>
    `,
    icon: "info",
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Save Final Decision",
    cancelButtonText: "Return to Review",
    customClass: {
      popup: "validation-popup",
      title: "validation-title",
      htmlContainer: "validation-html",
      confirmButton: "validation-confirm-btn",
      cancelButton: "validation-cancel-btn",
    },
    buttonsStyling: false,
    preConfirm: () => {
      const description = document
        .getElementById("validation-description")
        ?.value.trim();
      const saleStatus = document.getElementById("sale-status")?.value;

      if (!description) {
        Swal.showValidationMessage("Please enter the validation notes.");
        return false;
      }

      if (!saleStatus) {
        Swal.showValidationMessage("Selecciona el estatus comercial.");
        return false;
      }

      return { description, saleStatus };
    },
  });
//  mejorame el 
  if (!result.isConfirmed) return;

  try {
    const nextStatus =
      result.value.saleStatus === "activo" ? "seguimiento" : "validated";

    const { data, error } = await supabaseInventory
      .from("quotes")
      .update({
        status: nextStatus,
        validation_description: result.value.description,
        sale_status: result.value.saleStatus,
        sent_at: new Date().toISOString(),
      })
      .eq("id", quote.id)
      .select("id");

    if (error) throw error;
    if (!data?.length) {
      throw new Error(`No quote row was updated for id ${quote.id}`);
    }

    quote.status = nextStatus;
    quote.validation_description = result.value.description;
    quote.sale_status = result.value.saleStatus;
    quote.sent_at = new Date().toISOString();

    await Swal.fire({
      icon: "success",
      title: "Quote validated",
      text: "The quote was updated successfully.",
      timer: 1800,
      showConfirmButton: false,
    });

    await loadQuotes();
  } catch (err) {
    console.error(err);
    await feedback.error(
      "Unable to validate quote",
      err,
      "The quote could not be validated.",
    );
  }
};

const validateQuote = async (quote) => {
  try {
    await markQuoteAsFollowUp(quote);

    const target = router.resolve({
      name: "InventoryPdf",
      query: {
        quote_number: quote.quote_number,
        autoSend: "true",
        skipFollowUpLog: "true",
      },
    });

    hiddenAutoSendUrl.value = "";
    hiddenAutoSendUrl.value = `${target.href}${target.href.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
    feedback.notify(`Enviando cotizacion ${quote.quote_number}...`, "info");
  } catch (err) {
    console.error(err);
    await feedback.error(
      "Unable to start follow-up",
      err,
      "No se pudo cambiar la cotizacion a seguimiento.",
    );
  }
};

async function handleAutoSendMessage(event) {
  if (event.origin !== window.location.origin) return;

  const payload = event.data;

  if (!payload || payload.type !== "inventory-auto-send-result") return;

  hiddenAutoSendUrl.value = "";

  if (payload.status === "success") {
    await feedback.success(
      "Cotizacion enviada",
      payload.detail || `La cotizacion ${payload.quoteNumber} se envio correctamente.`,
    );
    router.replace({
      name: "QuotesValidation",
      query: {
        ...route.query,
        highlight_quote: payload.quoteNumber,
      },
    });
    await loadQuotes();
    return;
  }

  await feedback.error(
    "No se pudo enviar la cotizacion",
    null,
    payload.detail || `La cotizacion ${payload.quoteNumber} no pudo enviarse.`,
  );
}

const cancelQuote = async (quote) => {
  const result = await Swal.fire({
    icon: "warning",
    title: "Delete quote?",
    text: `Quote ${quote.quote_number} will be deleted permanently.`,
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#c62828",
  });

  if (!result.isConfirmed) return;

  try {
    const { error } = await supabaseInventory
      .from("quotes")
      .delete()
      .eq("id", quote.id);

    if (error) throw error;

    await Swal.fire({
      icon: "success",
      title: "Quote deleted",
      text: "The quote was removed successfully.",
      timer: 1800,
      showConfirmButton: false,
    });

    await loadQuotes();
  } catch (err) {
    console.error(err);
    await feedback.error(
      "Unable to delete quote",
      err,
      "The quote could not be deleted.",
    );
  }
};

const previewQuote = (quote) => {
  router.push({
    name: "InventoryPdf",
    query: {
      quote_number: quote.quote_number,
      preview: true,
    },
  });
};

const editQuote = (quote) => {
  router.push({
    name: "CreateInventoryQuote",
    query: {
      edit: "true",
      quote_number: quote.quote_number,
    },
  });
};

onMounted(() => {
  window.addEventListener("message", handleAutoSendMessage);
  loadQuotes();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleAutoSendMessage);
});
</script>

<template>
  <div class="page">
    <div class="page-top">
      <div>
        <p class="eyebrow">Inventory Workflow</p>
        <h1>Quotes Validation</h1>
        <p class="page-subtitle">
          Review inventory quotes, follow up with customers and complete the final validation process.
        </p>
      </div>

      <button class="refresh-btn" @click="loadQuotes">Refresh</button>
    </div>

    <div class="language-bar">
      <span class="language-label">Language</span>
      <div class="language-switch">
        <button
          class="language-btn"
          :class="{ active: selectedLanguage === 'en' }"
          @click="selectedLanguage = 'en'"
        >
          English
        </button>
        <button
          class="language-btn"
          :class="{ active: selectedLanguage === 'es' }"
          @click="selectedLanguage = 'es'"
        >
          Espanol
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <article class="stat-card">
        <span class="stat-label">Total Quotes</span>
        <strong class="stat-value">{{ summaryCards.total }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">Pending</span>
        <strong class="stat-value">{{ summaryCards.pending }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">Seguimiento</span>
        <strong class="stat-value">{{ summaryCards.followUp }}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">Validated</span>
        <strong class="stat-value">{{ summaryCards.validated }}</strong>
      </article>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Quote Queue</h2>
          <p>
            {{ visibleQuotes.length }} of {{ quotes.length }} record(s) available for review.
          </p>
        </div>
        <div class="queue-search">
          <input
            v-model="searchTerm"
            type="search"
            placeholder="Search quote, customer, item or description..."
          />
          <button
            v-if="searchTerm"
            type="button"
            class="clear-search-btn"
            @click="clearSearch"
          >
            Clear
          </button>
        </div>
      </div>

      <div class="actions-guide">
        <span class="actions-guide-label">Funciones:</span>
        <div class="actions-guide-list">
          <span class="guide-item">
            <span class="guide-icon guide-secondary" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <strong>View:</strong> vista previa de la cotizacion
          </span>
          <span class="guide-item">
            <span class="guide-icon guide-secondary" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9" />
                <path d="m16.5 3.5 4 4L7 21l-4 1 1-4 12.5-14.5Z" />
              </svg>
            </span>
            <strong>Edit:</strong> editar la cotizacion
          </span>
          <span class="guide-item">
            <span class="guide-icon guide-warning" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 8-4-16-3 8H2" />
              </svg>
            </span>
            <strong>Seguimiento:</strong> abrir el PDF para envio/seguimiento
          </span>
          <span class="guide-item">
            <span class="guide-icon guide-whatsapp" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.05 4.94A9.86 9.86 0 0 0 12.02 2a9.97 9.97 0 0 0-8.63 14.94L2 22l5.2-1.36A9.97 9.97 0 0 0 12.02 22h.01A9.98 9.98 0 0 0 22 12.02a9.86 9.86 0 0 0-2.95-7.08Zm-7.03 15.4h-.01a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3.09.81.82-3.01-.2-.31a8.3 8.3 0 1 1 7 3.85Zm4.56-6.2c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.57.13-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.13-1.04-.38-1.98-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.25-.02-.38.11-.51.12-.12.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.2-.49-.41-.42-.57-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.08.42 1.45.53.61.19 1.16.16 1.6.1.49-.07 1.47-.6 1.67-1.17.21-.58.21-1.08.15-1.18-.05-.1-.22-.17-.47-.29Z" />
              </svg>
            </span>
            <strong>WhatsApp:</strong> registrar y abrir mensaje al cliente
          </span>
          <span class="guide-item">
            <span class="guide-icon guide-call" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.66 2.62a2 2 0 0 1-.45 2.11L8.03 9.74a16 16 0 0 0 6.23 6.23l1.29-1.29a2 2 0 0 1 2.11-.45c.84.32 1.72.54 2.62.66A2 2 0 0 1 22 16.92Z" />
              </svg>
            </span>
            <strong>Llamada:</strong> registrar y marcar al cliente
          </span>
          <span class="guide-item">
            <span class="guide-icon guide-mail" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                <path d="m22 6-10 7L2 6" />
              </svg>
            </span>
            <strong>Correo:</strong> registrar y abrir email
          </span>
          <span class="guide-item">
            <span class="guide-icon guide-success" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <strong>Validate:</strong> cerrar validacion final
          </span>
          <span class="guide-item">
            <span class="guide-icon guide-danger" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="m19 6-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </span>
            <strong>Delete:</strong> eliminar la cotizacion
          </span>
        </div>
      </div>

      <div v-if="loading" class="loading-card">
        <div class="loading-spinner"></div>
        <p>Loading quotes...</p>
      </div>

      <div v-else-if="visibleQuotes.length" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Customer</th>
              <th>Numero</th>
              <th>Status</th>
              <th>Segimiento</th>
              <th>Date</th>
              <th>Items</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="quote in visibleQuotes"
              :key="quote.id"
              :class="[getRowClass(quote.status), { 'row-highlight': isHighlightedQuote(quote) }]"
            >
              <td data-label="Quote">
                <div class="quote-cell">
                  <strong>{{ quote.quote_number }}</strong>
                  <span>ID: {{ quote.id }}</span>
                </div>
              </td>
              <td data-label="Customer">
                <div class="customer-cell">
                  <strong>{{ quote.client_contact || "No contact" }}</strong>
                  <span>{{ quote.client_email || "No email" }}</span>
                </div>
              </td>
              <td data-label="Numero">
                <span class="phone-text">{{ quote.client_phone || "No phone" }}</span>
              </td>
              <td data-label="Status">
                <span class="status-badge" :class="getRowClass(quote.status)">
                  {{ getStatusLabel(quote.status) }}
                </span>
              </td>
              <td data-label="Seguimiento">
                <span
                  v-if="getLatestFollowUpChannel(quote)"
                  class="channel-badge"
                  :class="getChannelClass(getLatestFollowUpChannel(quote))"
                >
                  {{ getLatestFollowUpChannel(quote) }}
                </span>
                <span v-else>-</span>
              </td>
              <td data-label="Date">{{ formatDate(quote.created_at) }}</td>
              <td data-label="Items">
                <div class="items-cell">
                  <span class="items-badge">{{ quote.items?.length || 0 }}</span>
                  <div v-if="getPartNumbers(quote).length" class="part-number-inline">
                    <span class="part-number-text">
                      {{ getVisiblePartNumbers(quote).join(", ") }}
                    </span>
                    <span
                      v-if="getHiddenPartNumbersCount(quote)"
                      class="part-number-more"
                    >
                      +{{ getHiddenPartNumbersCount(quote) }}
                    </span>
                  </div>
                  <span v-else class="items-summary">
                    {{ getItemSummary(quote) }}
                  </span>
                </div>
              </td>
              <td class="description-cell" data-label="Description">
                <div v-if="getItemDescriptions(quote).length">
                  <span class="description-text">
                    {{ getVisibleItemDescriptions(quote).join(", ") }}
                  </span>
                  <span
                    v-if="getHiddenItemDescriptionsCount(quote)"
                    class="part-number-more"
                  >
                    +{{ getHiddenItemDescriptionsCount(quote) }}
                  </span>
                </div>
                <span v-else class="description-text description-empty">
                  No description yet
                </span>
                <span
                  v-if="getLatestFollowUpEntry(quote)"
                  class="followup-log"
                >
                  {{ getLatestFollowUpEntry(quote) }}
                </span>
              </td>
              <td data-label="Actions">
                <div class="actions">
                  <button
                    class="btn btn-secondary"
                    @click="previewQuote(quote)"
                    title="View"
                    aria-label="View"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </span>
                  </button>
                  <button
                    class="btn btn-secondary"
                    @click="editQuote(quote)"
                    title="Edit"
                    aria-label="Edit"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20h9" />
                        <path d="m16.5 3.5 4 4L7 21l-4 1 1-4 12.5-14.5Z" />
                      </svg>
                    </span>
                  </button>
                  <button
                    class="btn btn-warning"
                    @click="validateQuote(quote)"
                    title="Seguimiento"
                    aria-label="Seguimiento"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 12h-4l-3 8-4-16-3 8H2" />
                      </svg>
                    </span>
                  </button>
                  <button
                    class="btn btn-whatsapp"
                    @click="openWhatsAppFollowUp(quote)"
                    title="WhatsApp"
                    aria-label="WhatsApp"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.05 4.94A9.86 9.86 0 0 0 12.02 2a9.97 9.97 0 0 0-8.63 14.94L2 22l5.2-1.36A9.97 9.97 0 0 0 12.02 22h.01A9.98 9.98 0 0 0 22 12.02a9.86 9.86 0 0 0-2.95-7.08Zm-7.03 15.4h-.01a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3.09.81.82-3.01-.2-.31a8.3 8.3 0 1 1 7 3.85Zm4.56-6.2c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.57.13-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.13-1.04-.38-1.98-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.25-.02-.38.11-.51.12-.12.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.2-.49-.41-.42-.57-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.08.42 1.45.53.61.19 1.16.16 1.6.1.49-.07 1.47-.6 1.67-1.17.21-.58.21-1.08.15-1.18-.05-.1-.22-.17-.47-.29Z" />
                      </svg>
                    </span>
                  </button>
                  <button
                    class="btn btn-call"
                    @click="openCallFollowUp(quote)"
                    title="Llamada"
                    aria-label="Llamada"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.66 2.62a2 2 0 0 1-.45 2.11L8.03 9.74a16 16 0 0 0 6.23 6.23l1.29-1.29a2 2 0 0 1 2.11-.45c.84.32 1.72.54 2.62.66A2 2 0 0 1 22 16.92Z" />
                      </svg>
                    </span>
                  </button>
                  <button
                    class="btn btn-mail"
                    @click="openEmailFollowUp(quote)"
                    title="Correo"
                    aria-label="Correo"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                        <path d="m22 6-10 7L2 6" />
                      </svg>
                    </span>
                  </button>
                 
                  <button
                    class="btn btn-success"
                    @click="validateFinal(quote)"
                    title="Validate"
                    aria-label="Validate"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                  <button
                    class="btn btn-danger"
                    @click="cancelQuote(quote)"
                    title="Delete"
                    aria-label="Delete"
                  >
                    <span class="btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="m19 6-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <h3>No quotes available</h3>
        <p>New inventory quotes will appear here once they are created.</p>
      </div>
    </div>

    <iframe
      v-if="hiddenAutoSendUrl"
      :src="hiddenAutoSendUrl"
      class="hidden-auto-send-frame"
      title="Inventory auto send"
      aria-hidden="true"
      tabindex="-1"
    ></iframe>
  </div>
</template>

<style scoped>
.row-success {
  --row-accent: #2e7d32;
}

.row-warning {
  --row-accent: #f59e0b;
}

.row-danger {
  --row-accent: #dc2626;
}

.row-default {
  --row-accent: transparent;
}

.page {
  width: 100%;
  padding: 10px 0 36px;
  min-height: 100%;
  font-family: "Segoe UI", sans-serif;
  background: transparent;
  color: var(--text-main);
}

h1 {
  margin: 0 0 8px;
  color: var(--text-strong);
  font-size: 34px;
  letter-spacing: -0.03em;
}

.page-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0f5fa6;
}

.page-subtitle {
  max-width: 860px;
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}
.refresh-btn {
  border: 1px solid rgba(15, 95, 166, 0.18);
  background: var(--bg-surface-solid);
  color: var(--text-strong);
  border-radius: 14px;
  padding: 13px 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.refresh-btn:hover {
  border-color: #0f5fa6;
  color: #0f5fa6;
  transform: translateY(-1px);
}

.language-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 18px;
}

.language-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.language-switch {
  display: inline-flex;
  padding: 4px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
}

.language-btn {
  border: none;
  background: transparent;
  color: #475569;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.language-btn.active {
  background: #0f5fa6;
  color: white;
  box-shadow: 0 8px 16px rgba(15, 95, 166, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 20px;
}

.stat-card {
  background:
    linear-gradient(180deg, rgba(15, 95, 166, 0.05), rgba(255, 255, 255, 0)),
    var(--bg-surface-solid);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
}

.stat-label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.stat-value {
  font-size: 36px;
  color: var(--text-strong);
  letter-spacing: -0.03em;
}

.panel {
  background: var(--bg-surface-solid);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.07);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
  border-bottom: 1px solid #e2e8f0;
  background:
    linear-gradient(180deg, rgba(15, 95, 166, 0.05), rgba(15, 95, 166, 0)),
    var(--bg-surface-solid);
}

.panel-head h2 {
  margin: 0 0 4px;
  font-size: 18px;
  color: #0f172a;
}

.panel-head p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.queue-search {
  min-width: min(100%, 420px);
  display: flex;
  align-items: center;
  gap: 10px;
}

.queue-search input {
  width: 100%;
  min-height: 42px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 12px;
  padding: 10px 13px;
  background: white;
  color: #0f172a;
  font-size: 13px;
  outline: none;
}

.queue-search input:focus {
  border-color: #0f5fa6;
  box-shadow: 0 0 0 4px rgba(15, 95, 166, 0.12);
}

.clear-search-btn {
  min-height: 42px;
  border: none;
  border-radius: 12px;
  padding: 0 14px;
  background: #e8eef5;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.loading-card,
.empty-state {
  padding: 48px 24px;
  text-align: center;
}

.actions-guide {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fbff;
}

.actions-guide-label {
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
  white-space: nowrap;
}

.actions-guide-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.guide-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #475569;
  line-height: 1.4;
}

.guide-icon {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.guide-icon svg {
  width: 12px;
  height: 12px;
}

.guide-secondary {
  background: #e8eef5;
  color: #334155;
}

.guide-warning {
  background: #fef3c7;
  color: #d97706;
}

.guide-whatsapp {
  background: #dcfce7;
  color: #16a34a;
}

.guide-call {
  background: #ccfbf1;
  color: #0f766e;
}

.guide-mail {
  background: #dbeafe;
  color: #2563eb;
}

.guide-success {
  background: #dcfce7;
  color: #15803d;
}

.guide-danger {
  background: #fee2e2;
  color: #dc2626;
}

.loading-card p,
.empty-state p {
  margin: 0;
  color: #64748b;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 12px;
  border-radius: 50%;
  border: 3px solid #dbeafe;
  border-top-color: #0f5fa6;
  animation: spin 1s linear infinite;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #0f172a;
}

.hidden-auto-send-frame {
  position: absolute;
  width: 0;
  height: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 1210px;
  border-collapse: collapse;
  table-layout: fixed;
  background: transparent;
}

.table th {
  background: rgba(15, 95, 166, 0.06);
  color: #475569;
  padding: 12px 10px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  white-space: nowrap;
}

.table td {
  padding: 12px 10px;
  border-top: 1px solid #e5e7eb;
  font-size: 12px;
  vertical-align: top;
  color: var(--text-main);
}

.table th:nth-child(1),
.table td:nth-child(1) {
  width: 115px;
}

.table th:nth-child(2),
.table td:nth-child(2) {
  width: 190px;
}

.table th:nth-child(3),
.table td:nth-child(3) {
  width: 125px;
}

.table th:nth-child(4),
.table td:nth-child(4) {
  width: 90px;
}

.table th:nth-child(5),
.table td:nth-child(5) {
  width: 80px;
}

.table th:nth-child(6),
.table td:nth-child(6) {
  width: 100px;
}

.table th:nth-child(7),
.table td:nth-child(7) {
  width: 160px;
}

.table th:nth-child(8),
.table td:nth-child(8) {
  width: 175px;
}

.table th:nth-child(9),
.table td:nth-child(9) {
  width: 210px;
}

.table tr:hover {
  background: rgba(15, 95, 166, 0.04);
}

.table tbody tr {
  border-left: 5px solid var(--row-accent, transparent);
}

.table tbody tr.row-highlight {
  background: #fff7ed;
  box-shadow:
    inset 0 0 0 2px rgba(245, 158, 11, 0.35),
    inset 7px 0 0 #f59e0b;
}

.quote-cell,
.customer-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.quote-cell strong,
.customer-cell strong {
  font-size: 13px;
  color: #0f172a;
  line-height: 1.3;
}

.quote-cell span,
.customer-cell span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-text {
  display: inline-block;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  word-break: break-word;
}

.description-cell {
  min-width: 0;
  max-width: 150px;
  color: #475569;
  line-height: 1.45;
}

.description-text,
.followup-log {
  display: block;
}

.description-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  color: #0f172a;
  font-weight: 800;
}

.description-empty {
  color: #64748b;
  font-weight: 600;
}

.followup-log {
  margin-top: 6px;
  font-size: 10px;
  color: #0f5fa6;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.status-badge,
.items-badge,
.channel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
}

.status-badge.row-success {
  background: #dcfce7;
  color: #166534;
}

.status-badge.row-warning {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.row-danger {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.row-default {
  background: #e2e8f0;
  color: #475569;
}

.items-badge {
  min-width: 38px;
  min-height: 34px;
  font-size: 14px;
  font-weight: 800;
  background: #e0f2fe;
  color: #0369a1;
}

.items-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.part-number-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.part-number-more {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
}

.part-number-more {
  background: #f8fafc;
  color: #475569;
  border: 1px solid #cbd5e1;
}

.part-number-text {
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.items-summary {
  font-size: 12px;
  line-height: 1.35;
  color: #475569;
  word-break: break-word;
}

.channel-badge.channel-whatsapp {
  background: #dcfce7;
  color: #166534;
}

.channel-badge.channel-call {
  background: #ccfbf1;
  color: #115e59;
}

.channel-badge.channel-mail {
  background: #dbeafe;
  color: #1d4ed8;
}

.channel-badge.channel-default {
  background: #e2e8f0;
  color: #475569;
}

.actions {
  display: grid;
  grid-template-columns: repeat(4, 40px);
  gap: 6px;
  min-width: 190px;
  width: 100%;
}

.btn {
  border: none;
  border-radius: 10px;
  min-height: 40px;
  width: 40px;
  height: 40px;
  min-width: 40px;
  padding: 0;
  cursor: pointer;
  font-size: 10.5px;
  font-weight: 700;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  line-height: 1.2;
}

.btn-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-icon svg {
  width: 14px;
  height: 14px;
}

.btn-secondary {
  background: #e8eef5;
  color: #334155;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-success {
  background: #16a34a;
  color: white;
}

.btn-whatsapp {
  background: #25d366;
  color: white;
}

.btn-call {
  background: #0f766e;
  color: white;
}

.btn-mail {
  background: #2563eb;
  color: white;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
}

.btn-secondary:hover {
  background: #cbd5e1;
}

.btn-warning:hover {
  background: #d97706;
}

.btn-success:hover {
  background: #15803d;
}

.btn-whatsapp:hover {
  background: #1fb457;
}

.btn-call:hover {
  background: #115e59;
}

.btn-mail:hover {
  background: #1d4ed8;
}

.btn-danger:hover {
  background: #b91c1c;
}

:global(.validation-form) {
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;
}

:global(.validation-popup) {
  width: 620px;
  max-width: calc(100vw - 32px);
  border-radius: 24px;
  padding: 22px 22px 20px;
  background:
    radial-gradient(circle at top left, rgba(15, 95, 166, 0.08), transparent 30%),
    #ffffff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
}

:global(.validation-title) {
  margin-bottom: 6px;
  color: #0f172a;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

:global(.validation-html) {
  margin: 0;
  padding-top: 6px;
}

:global(.validation-hero) {
  padding: 16px 18px;
  border: 1px solid rgba(15, 95, 166, 0.14);
  border-radius: 18px;
  background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
}

:global(.validation-kicker) {
  display: inline-block;
  margin-bottom: 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0f5fa6;
}

:global(.validation-quote-number) {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

:global(.validation-helper) {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: #475569;
}

:global(.swal-label) {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

:global(.validation-textarea) {
  width: 100%;
  min-height: 150px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid #dbe3ee;
  border-radius: 16px;
  background: #fbfdff;
  color: var(--text-main);
  font-size: 14px;
  line-height: 1.55;
  box-sizing: border-box;
}

:global(.validation-select) {
  width: 100%;
  margin: 0;
  height: 52px;
  padding: 0 14px;
  border: 1px solid #dbe3ee;
  border-radius: 16px;
  background: #fbfdff;
  color: var(--text-main);
  font-size: 14px;
  box-sizing: border-box;
}

:global(.validation-textarea::placeholder),
:global(.validation-select::placeholder) {
  color: var(--text-faint);
}

:global(.validation-textarea:focus),
:global(.validation-select:focus) {
  border-color: #0f5fa6;
  box-shadow: 0 0 0 4px rgba(15, 95, 166, 0.12);
  outline: none;
}

:global(.validation-confirm-btn),
:global(.validation-cancel-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 190px;
  border: none;
  border-radius: 14px;
  padding: 12px 18px;
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  font-family: "Segoe UI", sans-serif;
  line-height: 1.1;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.validation-confirm-btn) {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  color: white;
  box-shadow: 0 10px 22px rgba(21, 128, 61, 0.25);
}

:global(.validation-cancel-btn) {
  background: linear-gradient(135deg, #e0ecff 0%, #c7dcff 100%);
  color: #0f3d75;
  box-shadow: 0 10px 22px rgba(15, 95, 166, 0.16);
}

:global(.validation-confirm-btn:hover),
:global(.validation-cancel-btn:hover) {
  transform: translateY(-1px);
}

:global(.validation-confirm-btn:hover) {
  background: linear-gradient(135deg, #15803d 0%, #166534 100%);
}

:global(.validation-cancel-btn:hover) {
  background: linear-gradient(135deg, #cfe3ff 0%, #b7d3ff 100%);
}

:global(.swal2-actions) {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  padding: 0;
}

:global(.swal2-validation-message) {
  border-radius: 14px;
  background: #fff7ed;
  color: #9a3412;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .page {
    padding: 4px 0 24px;
  }

  .panel-head {
    flex-direction: column;
    align-items: stretch;
  }

  .queue-search {
    min-width: 0;
    width: 100%;
  }

  .table-wrap {
    overflow: visible;
  }

  .table {
    min-width: 0;
    width: 100%;
    border: none;
    background: transparent;
    box-shadow: none;
    table-layout: auto;
  }

  .table,
  .table tbody,
  .table tr {
    width: 100%;
  }

  .table th:nth-child(1),
  .table td:nth-child(1),
  .table th:nth-child(2),
  .table td:nth-child(2),
  .table th:nth-child(3),
  .table td:nth-child(3),
  .table th:nth-child(4),
  .table td:nth-child(4),
  .table th:nth-child(5),
  .table td:nth-child(5),
  .table th:nth-child(6),
  .table td:nth-child(6),
  .table th:nth-child(7),
  .table td:nth-child(7),
  .table th:nth-child(8),
  .table td:nth-child(8),
  .table th:nth-child(9),
  .table td:nth-child(9) {
    width: auto;
  }

  .table thead {
    display: none;
  }

  .table tbody {
    display: grid;
    gap: 8px;
  }

  .table tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(92px, 0.7fr);
    grid-template-rows: auto auto;
    align-items: start;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-left: 4px solid var(--row-accent);
    border-radius: 14px;
    background: var(--bg-surface-solid);
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.05);
    overflow: hidden;
  }

  .table td {
    display: block;
    width: 100%;
    min-height: 0;
    padding: 8px 10px;
    border-bottom: none;
    text-align: left;
  }

  .table td:last-child {
    border-bottom: none;
  }

  .table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .table td[data-label="Quote"] {
    padding-top: 10px;
    grid-column: 1;
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .table td[data-label="Quote"]::before,
  .table td[data-label="Status"]::before {
    margin-bottom: 8px;
  }

  .table td[data-label="Status"] {
    grid-column: 2;
    grid-row: 1;
    padding-top: 10px;
    padding-left: 8px;
    min-width: 0;
    padding-right: 0;
    justify-self: stretch;
  }

  .table td[data-label="Customer"],
  .table td[data-label="Sale"],
  .table td[data-label="Seguimiento"],
  .table td[data-label="Description"],
  .table td[data-label="Date"],
  .table td[data-label="Items"] {
    display: none;
  }

  .quote-cell,
  .customer-cell {
    gap: 2px;
    min-height: 100%;
  }

  .quote-cell strong,
  .customer-cell strong {
    font-size: 12px;
    line-height: 1.2;
  }

  .quote-cell span,
  .customer-cell span {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    font-size: 9px;
    line-height: 1.2;
    word-break: break-word;
  }

  .description-cell {
    max-width: none;
  }

  .description-text {
    display: block;
    -webkit-line-clamp: unset;
    overflow: visible;
    font-size: 11px;
    line-height: 1.35;
  }

  .followup-log {
    margin-top: 5px;
    font-size: 9.5px;
    line-height: 1.25;
  }

  .table td[data-label="Actions"] {
    grid-column: 2;
    grid-row: 2;
    padding-top: 6px;
    padding-left: 8px;
    padding-right: 0;
    background: transparent;
    justify-self: stretch;
  }

  .table td[data-label="Actions"]::before {
    display: none;
  }

  .status-badge,
  .channel-badge,
  .items-badge {
    min-height: 22px;
    padding: 2px 7px;
    font-size: 9px;
  }

  .table td[data-label="Status"] .status-badge {
    margin-bottom: 0;
  }

  .actions {
    width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    justify-content: stretch;
  }

  .btn {
    width: 100%;
    min-width: 0;
    height: 22px;
    min-height: 22px;
    border-radius: 7px;
  }

  .btn-icon,
  .btn-icon svg {
    width: 9px;
    height: 9px;
  }

  .page-top {
    flex-direction: column;
  }

  .language-bar {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .stats-grid {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(150px, 1fr);
    grid-template-columns: none;
    gap: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 6px;
    margin-bottom: 16px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-label {
    margin-bottom: 8px;
    font-size: 10px;
  }

  .stat-value {
    font-size: 28px;
  }

  .actions-guide {
    flex-direction: column;
  }

  .panel-head {
    padding: 16px 18px;
  }

  .panel-head h2 {
    font-size: 16px;
  }

  .panel-head p {
    font-size: 12px;
  }

  .actions-guide {
    gap: 8px;
    padding: 10px 12px;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .actions-guide-label {
    font-size: 11px;
  }

  .actions-guide-list {
    flex-wrap: nowrap;
    gap: 8px;
    min-width: max-content;
  }

  .guide-item {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 66px;
    padding: 8px 6px;
    border-radius: 14px;
    background: white;
    border: 1px solid rgba(148, 163, 184, 0.18);
    text-align: center;
    font-size: 9px;
    line-height: 1.2;
  }

  .guide-item strong {
    display: block;
  }

  .guide-item strong::after {
    content: "";
  }

  .guide-item :not(.guide-icon):not(strong) {
    display: none;
  }

  .guide-icon {
    width: 22px;
    height: 22px;
  }

  .guide-icon svg {
    width: 12px;
    height: 12px;
  }
}

@media (max-width: 520px) {
  .table td {
    padding: 7px 8px;
  }

  .table tbody tr {
    grid-template-columns: minmax(0, 1.22fr) minmax(88px, 0.78fr);
    grid-template-rows: auto auto;
  }

  .actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
