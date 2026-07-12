<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import { useFeedback } from "@/composables/useFeedback";
import { deleteCampaignImage, uploadCampaignImage } from "../services/bulkEmailStorage.service";
import { getBulkEmailAccessStatus } from "../services/bulkEmailAccess.service";
import { useBulkEmailRecipients } from "../composables/useBulkEmailRecipients";
import { getDefaultBulkEmailDraft } from "../utils/bulkEmailTemplate";
import BulkEmailImageUploader from "./BulkEmailImageUploader.vue";
import BulkEmailRecipientsImporter from "./BulkEmailRecipientsImporter.vue";
import BulkEmailRecipientsTable from "./BulkEmailRecipientsTable.vue";

const props = defineProps({
  campaign: {
    type: Object,
    default: null,
  },
  saving: Boolean,
  sending: Boolean,
  sendingProgress: {
    type: Object,
    default: () => ({
      current: 0,
      total: 0,
      sent: 0,
      failed: 0,
    }),
  },
  ensureCampaign: {
    type: Function,
    default: null,
  },
});

const emit = defineEmits(["save-draft", "start-campaign", "send-test", "saved"]);
const feedback = useFeedback();
const router = useRouter();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function createDraft() {
  return getDefaultBulkEmailDraft();
}

const draft = reactive(createDraft());
const errors = reactive({});
const testEmail = ref("");
const imageUploading = ref(false);
const imageError = ref("");
const accessLoading = ref(true);
const accessStatus = ref({
  hasInventorySession: false,
  inventorySessionError: "",
  inventoryUserEmail: "",
  roles: [],
  hasAdminRole: false,
  canCallPhpApi: false,
  canAttemptStorageUpload: false,
  warnings: [],
});
const recipients = useBulkEmailRecipients(computed(() => props.campaign?.id || null));
const {
  importedRows,
  importSummary,
  importing,
  recipientRows,
  loading: recipientsLoading,
  pagination: recipientsPagination,
  totalPages: recipientsTotalPages,
  prepareRecipients,
  prepareRecipientsFromCsv,
  prepareRecipientsFromSpreadsheet,
  prepareRecipientsFromText,
  clearImportedRows,
  confirmImport,
  deleteRecipient,
  loadRecipients,
} = recipients;

const unsupportedFields = [
  "Nombre interno dedicado",
  "TÃ­tulo principal persistente",
  "HTML persistente",
  "Texto plano persistente",
  "CTA persistente",
  "ProgramaciÃ³n persistente",
  "ImÃ¡genes adicionales persistentes",
];

const canManageRecipients = computed(() => Boolean(props.campaign?.id));
const canUploadImage = computed(() => accessStatus.value.canAttemptStorageUpload && !accessLoading.value);
const canUsePhpActions = computed(() => accessStatus.value.canCallPhpApi && !accessLoading.value);
const accessWarningText = computed(() => accessStatus.value.warnings.join(" "));
const inventoryLoginTarget = computed(() => {
  const redirect = props.campaign?.id ? `/correos-masivos/${props.campaign.id}/editar` : "/correos-masivos/nueva";
  return `/inventory-login?redirect=${encodeURIComponent(redirect)}`;
});

function syncDraft() {
  const defaults = createDraft();
  Object.assign(draft, defaults, {
    subject: props.campaign?.subject || "",
    status: props.campaign?.status || "draft",
    sender_name: props.campaign?.sender_name || defaults.sender_name,
    sender_email: props.campaign?.sender_email || defaults.sender_email,
    reply_to: props.campaign?.reply_to || defaults.reply_to,
    image_url: props.campaign?.image_url || props.campaign?.image_preview_url || "",
    image_path: props.campaign?.image_path || "",
  });
  imageError.value = "";
}

async function loadAccessStatus() {
  accessLoading.value = true;
  try {
    accessStatus.value = await getBulkEmailAccessStatus();
  } finally {
    accessLoading.value = false;
  }
}

function clearErrors() {
  Object.keys(errors).forEach((key) => {
    delete errors[key];
  });
}

function validate() {
  clearErrors();
  if (!draft.subject.trim()) {
    errors.subject = "El asunto es obligatorio.";
  }
  if (!String(draft.content_html || draft.content_text || "").trim()) {
    errors.content_html = "El contenido es obligatorio.";
  }
  if (!draft.sender_name.trim()) {
    errors.sender_name = "El nombre del remitente es obligatorio.";
  }
  if (!draft.sender_email.trim()) {
    errors.sender_email = "El correo del remitente es obligatorio.";
  } else if (!EMAIL_PATTERN.test(draft.sender_email.trim())) {
    errors.sender_email = "El correo del remitente no es vÃ¡lido.";
  }
  if (draft.reply_to.trim() && !EMAIL_PATTERN.test(draft.reply_to.trim())) {
    errors.reply_to = "El correo Reply-To no es vÃ¡lido.";
  }
  if (draft.button_url.trim()) {
    try {
      new URL(draft.button_url.trim());
    } catch {
      errors.button_url = "La URL del botÃ³n no es vÃ¡lida.";
    }
  }
  return Object.keys(errors).length === 0;
}

async function saveDraft() {
  if (!validate()) {
    return;
  }

  emit("save-draft", { ...draft });
}

async function ensureCampaignReady() {
  if (props.campaign?.id) {
    return props.campaign;
  }
  if (!validate()) {
    return null;
  }
  if (!props.ensureCampaign) {
    throw new Error("No fue posible preparar la campaÃƒÂ±a.");
  }

  const savedCampaign = await props.ensureCampaign({ ...draft });
  await nextTick();
  return savedCampaign || props.campaign || null;
}

async function startCampaignFlow() {
  if (props.sending) {
    return;
  }
  if (!canUsePhpActions.value) {
    feedback.warning(
      "Falta sesion de Inventory",
      accessWarningText.value || "Vuelve a iniciar sesion para habilitar acciones del backend PHP.",
    );
    return;
  }
  if (!validate()) {
    return;
  }
  if (importSummary.ready > 0) {
    await confirmImportFlow();
  }
  if ((recipientsPagination.total || recipientRows.length || 0) <= 0) {
    feedback.warning("Sin destinatarios", "Importa al menos un destinatario valido antes de enviar.");
    return;
  }

  const totalRecipients = recipientsPagination.total || recipientRows.length || 0;
  const confirmation = await feedback.confirm({
    title: "Enviar correo a todos",
    text: `Se enviara este correo a ${totalRecipients} destinatario(s). ¿Deseas continuar?`,
    confirmButtonText: "Enviar",
    cancelButtonText: "Cancelar",
    icon: "warning",
  });

  if (!confirmation.isConfirmed) {
    return;
  }

  emit("start-campaign", { ...draft });
}

async function sendTestFlow() {
  if (!canUsePhpActions.value) {
    feedback.warning(
      "Falta sesiÃ³n de Inventory",
      accessWarningText.value || "Vuelve a iniciar sesiÃ³n para habilitar acciones del backend PHP.",
    );
    return;
  }
  if (!validate()) {
    return;
  }
  if (!testEmail.value.trim()) {
    feedback.warning("Falta correo de prueba", "Escribe un correo antes de enviar la prueba.");
    return;
  }
  if (!EMAIL_PATTERN.test(testEmail.value.trim())) {
    feedback.warning("Correo invÃ¡lido", "El correo de prueba no tiene un formato vÃ¡lido.");
    return;
  }
  emit("send-test", {
    campaign: {
      ...(props.campaign || {}),
      ...draft,
    },
    email: testEmail.value.trim(),
  });
}

async function uploadImage(file) {
  if (!canUploadImage.value) {
    imageError.value = accessWarningText.value || "No existe una sesiÃ³n vÃ¡lida en Supabase Inventory para usar Storage.";
    return;
  }

  imageUploading.value = true;
  imageError.value = "";

  try {
    const upload = await uploadCampaignImage({
      campaignId: props.campaign?.id || "draft",
      file,
    });
    draft.image_url = upload.url;
    draft.image_path = upload.path;
  } catch (err) {
    const message = err?.message || "No fue posible subir la imagen.";
    imageError.value = message.includes("row-level security")
      ? "Supabase rechazÃ³ la carga por polÃ­ticas RLS del bucket `bulk-email-images`. Verifica que la sesiÃ³n de Inventory tenga permisos sobre Storage."
      : message;
  } finally {
    imageUploading.value = false;
  }
}

async function removeImage() {
  if (!draft.image_path) {
    draft.image_url = "";
    return;
  }

  try {
    await deleteCampaignImage(draft.image_path);
    draft.image_url = "";
    draft.image_path = "";
  } catch (err) {
    imageError.value = err?.message || "No fue posible eliminar la imagen.";
  }
}

async function confirmImportFlow() {
  try {
    const savedCampaign = await ensureCampaignReady();
    if (!savedCampaign?.id && !props.campaign?.id) {
      return;
    }
    await confirmImport();
    feedback.success("Destinatarios importados", "La lista quedÃ³ guardada en la campaÃ±a.");
  } catch (error) {
    feedback.error("No fue posible importar destinatarios", error);
  }
}

async function removeRecipientFlow(row) {
  try {
    await deleteRecipient(row.id);
    feedback.notify("Destinatario eliminado");
  } catch (error) {
    feedback.error("No fue posible eliminar el destinatario", error);
  }
}

watch(
  () => props.campaign,
  async () => {
    syncDraft();
    await loadAccessStatus();
    if (props.campaign?.id) {
      await loadRecipients();
    }
  },
  { immediate: true },
);

onMounted(loadAccessStatus);
</script>

<template>
  <section class="simple-send-form">
    <section v-if="accessLoading || accessWarningText" class="form-section access-banner" :class="{ 'access-banner-warning': accessWarningText }">
      <p v-if="accessLoading">Validando sesiÃ³n de Inventory...</p>
      <p v-else>{{ accessWarningText }}</p>
    </section>

    <section class="form-section">
      <h2>Enviar correo masivo</h2>

      <label class="field">
        <span>Asunto</span>
        <input v-model="draft.subject" type="text" placeholder="Asunto del correo" />
        <small v-if="errors.subject" class="error-text">{{ errors.subject }}</small>
      </label>

      <label class="field">
        <span>TÃ­tulo</span>
        <input v-model="draft.main_title" type="text" placeholder="TÃ­tulo principal" />
      </label>

      <label class="field">
        <span>Contenido</span>
        <textarea v-model="draft.content_html" rows="7" placeholder="Escribe el contenido del correo"></textarea>
        <small v-if="errors.content_html" class="error-text">{{ errors.content_html }}</small>
      </label>

      <div class="field">
        <span>Imagen opcional</span>
        <BulkEmailImageUploader
          :image-url="draft.image_url"
          :image-path="draft.image_path"
          :uploading="imageUploading"
          :error="imageError"
          :disabled="!canUploadImage || sending"
          @upload="uploadImage"
          @remove="removeImage"
        />
      </div>
    </section>

    <section class="form-section">
      <BulkEmailRecipientsImporter
        :rows="importedRows"
        :summary="importSummary"
        :importing="importing"
        :disabled="!accessStatus.hasInventorySession || sending"
        @prepare-csv="prepareRecipientsFromCsv"
        @prepare-spreadsheet="prepareRecipientsFromSpreadsheet"
        @prepare-text="prepareRecipientsFromText"
        @prepare-single="prepareRecipients"
        @confirm-import="confirmImportFlow"
        @clear="clearImportedRows"
      />

      <BulkEmailRecipientsTable
        :rows="recipientRows"
        :loading="recipientsLoading"
        :page="recipientsPagination.page"
        :total-pages="recipientsTotalPages"
        removable
        @page-change="(page) => { recipientsPagination.page = page; loadRecipients(); }"
        @remove="removeRecipientFlow"
      />

      <p class="recipient-total">Total de destinatarios: {{ recipientsPagination.total || recipientRows.length || 0 }}</p>
    </section>

    <button
      type="button"
      class="send-all-button"
      :disabled="saving || sending || !canUsePhpActions"
      @click="startCampaignFlow"
    >
      <span v-if="sending">Enviando {{ sendingProgress.current }} de {{ sendingProgress.total }}...</span>
      <span v-else>Enviar correo a todos</span>
    </button>
  </section>
</template>

<style scoped>
.simple-send-form {
  display: grid;
  gap: 18px;
  max-width: 960px;
  margin: 0 auto;
}

.simple-send-form h2 {
  margin: 0;
  color: var(--text-strong);
}

.recipient-total {
  margin: 0;
  color: var(--text-strong);
  font-weight: 800;
}

.send-all-button {
  width: 100%;
  min-height: 52px;
  padding: 12px 20px;
  border: 0;
  border-radius: 10px;
  background: #075da8;
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.send-all-button:hover:not(:disabled) {
  background: #064f8f;
}

.send-all-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);
  gap: 20px;
}

.form-main,
.form-side {
  display: grid;
  gap: 18px;
}

.form-section {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-sm);
}

.section-head h3 {
  margin: 0 0 6px;
  color: var(--text-strong);
}

.section-head p,
.field small,
.unsupported-list {
  margin: 0;
  color: var(--text-muted);
}

.inventory-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-weight: 700;
  color: var(--text-strong);
}

.field input,
.field select,
.field textarea {
  padding: 12px 14px;
}

.field-span-2 {
  grid-column: span 2;
}

.unsupported-list {
  padding-left: 18px;
}

.side-box {
  align-content: start;
}

.side-actions {
  display: grid;
  gap: 10px;
}

.error-text {
  color: var(--danger);
}

.access-banner {
  border-style: dashed;
}

.access-banner-warning {
  background: linear-gradient(180deg, rgba(217, 119, 6, 0.08), var(--bg-surface-solid));
}

@media (max-width: 1100px) {
  .form-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: span 1;
  }
}
</style>






