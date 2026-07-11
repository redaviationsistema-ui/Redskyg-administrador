<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import BaseButton from "@/components/ui/BaseButton.vue";
import { useFeedback } from "@/composables/useFeedback";
import { deleteCampaignImage, uploadCampaignImage } from "../services/bulkEmailStorage.service";
import { getBulkEmailAccessStatus } from "../services/bulkEmailAccess.service";
import { useBulkEmailRecipients } from "../composables/useBulkEmailRecipients";
import { getDefaultBulkEmailDraft } from "../utils/bulkEmailTemplate";
import BulkEmailImageUploader from "./BulkEmailImageUploader.vue";
import BulkEmailPreview from "./BulkEmailPreview.vue";
import BulkEmailRecipientsImporter from "./BulkEmailRecipientsImporter.vue";
import BulkEmailRecipientsTable from "./BulkEmailRecipientsTable.vue";

const props = defineProps({
  campaign: {
    type: Object,
    default: null,
  },
  saving: Boolean,
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
  "Título principal persistente",
  "HTML persistente",
  "Texto plano persistente",
  "CTA persistente",
  "Programación persistente",
  "Imágenes adicionales persistentes",
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
  if (!draft.sender_name.trim()) {
    errors.sender_name = "El nombre del remitente es obligatorio.";
  }
  if (!draft.sender_email.trim()) {
    errors.sender_email = "El correo del remitente es obligatorio.";
  } else if (!EMAIL_PATTERN.test(draft.sender_email.trim())) {
    errors.sender_email = "El correo del remitente no es válido.";
  }
  if (draft.reply_to.trim() && !EMAIL_PATTERN.test(draft.reply_to.trim())) {
    errors.reply_to = "El correo Reply-To no es válido.";
  }
  if (draft.button_url.trim()) {
    try {
      new URL(draft.button_url.trim());
    } catch {
      errors.button_url = "La URL del botón no es válida.";
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

async function startCampaignFlow() {
  if (!canUsePhpActions.value) {
    feedback.warning(
      "Falta sesión de Inventory",
      accessWarningText.value || "Vuelve a iniciar sesión para habilitar acciones del backend PHP.",
    );
    return;
  }
  if (!validate()) {
    return;
  }
  if ((recipientsPagination.total || recipientRows.length || 0) <= 0) {
    feedback.warning("Sin destinatarios", "Importa al menos un destinatario válido antes de iniciar la campaña.");
    return;
  }

  emit("start-campaign", { ...draft });
}

async function sendTestFlow() {
  if (!canUsePhpActions.value) {
    feedback.warning(
      "Falta sesión de Inventory",
      accessWarningText.value || "Vuelve a iniciar sesión para habilitar acciones del backend PHP.",
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
    feedback.warning("Correo inválido", "El correo de prueba no tiene un formato válido.");
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
    imageError.value = accessWarningText.value || "No existe una sesión válida en Supabase Inventory para usar Storage.";
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
      ? "Supabase rechazó la carga por políticas RLS del bucket `bulk-email-images`. Verifica que la sesión de Inventory tenga permisos sobre Storage."
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
    await confirmImport();
    feedback.success("Destinatarios importados", "La lista quedó guardada en la campaña.");
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
  <section class="form-layout">
    <div class="form-main">
      <section v-if="accessLoading || accessWarningText" class="form-section access-banner" :class="{ 'access-banner-warning': accessWarningText }">
        <h3>Diagnóstico de Inventory</h3>
        <p v-if="accessLoading">Validando sesión y capacidades de Supabase Inventory...</p>
        <template v-else>
          <p v-if="accessStatus.inventoryUserEmail">
            Sesión Inventory detectada para <strong>{{ accessStatus.inventoryUserEmail }}</strong>.
          </p>
          <p v-if="accessStatus.roles.length">
            Roles detectados: <strong>{{ accessStatus.roles.join(", ") }}</strong>.
          </p>
          <p v-if="accessWarningText">{{ accessWarningText }}</p>
          <p v-if="!accessStatus.hasInventorySession">
            Cierra sesión y vuelve a entrar para crear también la sesión en el proyecto Inventory.
          </p>
          <div v-if="!accessStatus.hasInventorySession" class="inventory-actions">
            <BaseButton variant="secondary" @click="router.push(inventoryLoginTarget)">
              Iniciar sesión en Inventory
            </BaseButton>
          </div>
        </template>
      </section>

      <section class="form-section">
        <header class="section-head">
          <div>
            <h3>Información general</h3>
            <p>La tabla actual persiste `subject`, `status`, `sender_name`, `sender_email`, `reply_to`, `image_url` e `image_path`.</p>
          </div>
        </header>

        <div class="form-grid">
          <label class="field">
            <span>Nombre interno de campaña</span>
            <input :value="draft.subject" type="text" readonly />
            <small>La tabla no expone columna dedicada; se usa el asunto actual como nombre interno.</small>
          </label>

          <label class="field">
            <span>Asunto</span>
            <input v-model="draft.subject" type="text" placeholder="Presentación SkyGroup Fleet" />
            <small v-if="errors.subject" class="error-text">{{ errors.subject }}</small>
          </label>

          <label class="field">
            <span>Estado</span>
            <select v-model="draft.status">
              <option value="draft">Borrador</option>
              <option value="scheduled">Programada</option>
              <option value="processing">En proceso</option>
              <option value="completed">Completada</option>
              <option value="paused">Pausada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
        </div>
      </section>

      <section class="form-section">
        <header class="section-head">
          <div>
            <h3>Remitente</h3>
            <p>Campos disponibles en tabla: `sender_name`, `sender_email`, `reply_to`.</p>
          </div>
        </header>

        <div class="form-grid">
          <label class="field">
            <span>Nombre del remitente</span>
            <input v-model="draft.sender_name" type="text" />
            <small v-if="errors.sender_name" class="error-text">{{ errors.sender_name }}</small>
          </label>

          <label class="field">
            <span>Correo del remitente</span>
            <input v-model="draft.sender_email" type="email" />
            <small v-if="errors.sender_email" class="error-text">{{ errors.sender_email }}</small>
          </label>

          <label class="field">
            <span>Correo Reply-To</span>
            <input v-model="draft.reply_to" type="email" />
            <small v-if="errors.reply_to" class="error-text">{{ errors.reply_to }}</small>
          </label>
        </div>
      </section>

      <section class="form-section">
        <header class="section-head">
          <div>
            <h3>Contenido</h3>
            <p>Estos campos se muestran porque forman parte del flujo pedido, pero hoy no tienen columna persistente en `bulk_email_campaigns`.</p>
          </div>
        </header>

        <div class="form-grid">
          <label class="field">
            <span>Título principal</span>
            <input v-model="draft.main_title" type="text" placeholder="Próximas oportunidades SkyGroup" />
          </label>
          <label class="field">
            <span>Texto del botón</span>
            <input v-model="draft.button_text" type="text" placeholder="Ver flota" />
          </label>
          <label class="field">
            <span>URL del botón</span>
            <input v-model="draft.button_url" type="url" placeholder="https://..." />
            <small v-if="errors.button_url" class="error-text">{{ errors.button_url }}</small>
          </label>
          <label class="field field-span-2">
            <span>Contenido HTML</span>
            <textarea v-model="draft.content_html" rows="6" placeholder="<p>Contenido HTML...</p>"></textarea>
          </label>
          <label class="field field-span-2">
            <span>Contenido de texto plano</span>
            <textarea v-model="draft.content_text" rows="4" placeholder="Versión de texto plano"></textarea>
          </label>
        </div>

        <ul class="unsupported-list">
          <li v-for="item in unsupportedFields" :key="item">{{ item }}: columna no encontrada en la tabla actual.</li>
        </ul>
      </section>

      <section class="form-section">
        <header class="section-head">
          <div>
            <h3>Imágenes</h3>
            <p>Persistencia real detectada: `image_url` e `image_path`.</p>
          </div>
        </header>

        <BulkEmailImageUploader
          :image-url="draft.image_url"
          :image-path="draft.image_path"
          :uploading="imageUploading"
          :error="imageError"
          :disabled="!canUploadImage"
          @upload="uploadImage"
          @remove="removeImage"
        />
      </section>

      <section class="form-section">
        <header class="section-head">
          <div>
            <h3>Destinatarios</h3>
            <p>Campos verificados: `campaign_id`, `email`, `normalized_email`, `name`, `domain`, `created_at`.</p>
          </div>
        </header>

        <BulkEmailRecipientsImporter
          :rows="importedRows"
          :summary="importSummary"
          :importing="importing"
          :disabled="!canManageRecipients || !accessStatus.hasInventorySession"
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
      </section>
    </div>

    <aside class="form-side">
      <BulkEmailPreview :values="draft" :image-preview-url="draft.image_url" />

      <section class="form-section side-box">
        <h3>Configuración del envío</h3>
        <p>La programación opcional no tiene columna persistente en la tabla actual.</p>
        <label class="field">
          <span>Correo para prueba</span>
          <input v-model="testEmail" type="email" placeholder="qa@empresa.com" />
        </label>

        <div class="side-actions">
          <BaseButton variant="secondary" :disabled="saving || !canUsePhpActions" @click="sendTestFlow">Enviar prueba</BaseButton>
          <BaseButton variant="secondary" :disabled="saving" @click="saveDraft">Guardar borrador</BaseButton>
          <BaseButton :disabled="saving || !canUsePhpActions" @click="startCampaignFlow">Iniciar campaña</BaseButton>
        </div>
      </section>
    </aside>
  </section>
</template>

<style scoped>
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
