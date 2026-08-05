<script setup>
import { computed, reactive, ref, watch } from "vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import { CHANNELS, LANGUAGES, REGIONS } from "../services/responseTemplates.service";
import { extractTemplateVariables, renderTemplate, TEMPLATE_PREVIEW_VALUES } from "../utils/templateVariables";

const props = defineProps({ open: Boolean, template: Object, categories: Array, variables: Array, saving: Boolean });
const emit = defineEmits(["close", "save"]);
const errors = ref({});
const previewOpen = ref(false);
const editorContent = ref("");
const form = reactive({ name: "", slug: "", description: "", category: "", region: "MX", language: "es", channels: [], subject: "", content: "", status: "active", display_order: 0 });
const technicalContent = computed(() => editorContent.value);
const preview = computed(() => renderTemplate(technicalContent.value, TEMPLATE_PREVIEW_VALUES).message);

watch(() => [props.open, props.template], () => {
  if (!props.open) return;
  Object.assign(form, { name: "", slug: "", description: "", category: "", region: "MX", language: "es", channels: [], subject: "", content: "", status: "active", display_order: 0, ...(props.template || {}), channels: [...(props.template?.channels || [])] });
  errors.value = {};
  previewOpen.value = false;
  editorContent.value = form.content || "";
}, { immediate: true, deep: true });

function validate() {
  const next = {};
  for (const key of ["name", "category", "region", "language"]) if (!String(form[key] || "").trim()) next[key] = "Campo obligatorio";
  if (!form.channels.length) next.channels = "Selecciona al menos un canal";
  if (!technicalContent.value.trim()) next.content = "Campo obligatorio";
  if (technicalContent.value.length > 20000) next.content = "Máximo 20,000 caracteres";
  const order = Number(form.display_order);
  if (!Number.isInteger(order) || order < 0) next.display_order = "Debe ser un entero igual o mayor que cero";
  errors.value = next;
  return !Object.keys(next).length;
}
function submit() { if (validate()) emit("save", { ...form, slug: form.slug, content: technicalContent.value, variables: extractTemplateVariables(`${form.subject || ""} ${technicalContent.value}`), channels: [...form.channels] }); }
</script>

<template>
  <BaseModal :open="open" :title="template?.id ? 'Editar plantilla' : 'Nueva plantilla'" hide-footer max-width="860px" @close="emit('close')">
    <form class="template-form" @submit.prevent="submit">
      <div class="form-grid">
        <label><span>Nombre *</span><input v-model="form.name" maxlength="160" /><small v-if="errors.name">{{ errors.name }}</small></label>
        <label><span>Categoría *</span><input v-model="form.category" list="template-categories" maxlength="120" /><datalist id="template-categories"><option v-for="item in categories" :key="item" :value="item" /></datalist><small v-if="errors.category">{{ errors.category }}</small></label>
        <label><span>Región *</span><select v-model="form.region"><option v-for="item in REGIONS" :key="item" :value="item">{{ item === 'MX' ? 'México' : 'USA' }}</option></select></label>
        <label><span>Idioma *</span><select v-model="form.language"><option v-for="item in LANGUAGES" :key="item" :value="item">{{ item === 'es' ? 'Español' : 'Inglés' }}</option></select></label>
        <label class="wide"><span>Descripción</span><input v-model="form.description" maxlength="500" /></label>
        <fieldset class="wide"><legend>Canales *</legend><label v-for="channel in CHANNELS" :key="channel" class="check"><input v-model="form.channels" type="checkbox" :value="channel" /> {{ { whatsapp:'WhatsApp', email:'Email', instagram:'Instagram', web:'Web', phone:'Teléfono', copy:'Copiar' }[channel] }}</label><small v-if="errors.channels">{{ errors.channels }}</small></fieldset>
        <label v-if="form.channels.includes('email')" class="wide"><span>Asunto del correo</span><input v-model="form.subject" maxlength="250" /></label>
        <label class="wide"><span>Contenido *</span><textarea v-model="editorContent" rows="10" maxlength="20000"></textarea><small :class="{ error: errors.content }">{{ errors.content || `${technicalContent.length}/20,000` }}</small></label>
        <div class="wide preview-controls"><BaseButton variant="secondary" @click="previewOpen = !previewOpen">{{ form.language === 'en' ? 'Preview' : 'Vista previa' }}</BaseButton></div>
        <section v-if="previewOpen" class="wide content-preview" aria-live="polite"><strong>{{ form.language === 'en' ? 'Example preview' : 'Vista previa con datos de ejemplo' }}</strong><pre>{{ preview }}</pre><small>{{ form.language === 'en' ? 'Example values are not saved.' : 'Los valores de ejemplo no se guardan.' }}</small></section>
        <label><span>Estado</span><select v-model="form.status"><option value="active">Activa</option><option value="inactive">Inactiva</option><option value="draft">Borrador</option><option value="archived">Archivada</option></select></label>
        <label><span>Orden</span><input v-model.number="form.display_order" type="number" min="0" step="1" /><small v-if="errors.display_order">{{ errors.display_order }}</small></label>
      </div>
      <div class="actions"><BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton><BaseButton type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</BaseButton></div>
    </form>
  </BaseModal>
</template>

<style scoped>
.template-form{max-height:72vh;overflow:auto;padding-right:4px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.wide{grid-column:1/-1}label>span,legend{display:block;margin-bottom:6px;color:var(--text-muted);font-size:.8rem;font-weight:800}input,select,textarea{padding:11px 13px}textarea{resize:vertical;white-space:pre-wrap}small{display:block;margin-top:5px;color:var(--danger)}fieldset{margin:0;padding:12px;border:1px solid var(--border-color);border-radius:14px}.check{display:inline-flex;align-items:center;gap:6px;margin:4px 18px 4px 0}.check input{width:auto}.preview-controls{display:flex;justify-content:flex-start}.content-preview{padding:16px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-soft)}.content-preview pre{margin:12px 0;white-space:pre-wrap;word-break:break-word;font:inherit;color:var(--text-main)}.content-preview small{color:var(--text-faint)}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}@media(max-width:640px){.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.actions{flex-direction:column-reverse}}
</style>
