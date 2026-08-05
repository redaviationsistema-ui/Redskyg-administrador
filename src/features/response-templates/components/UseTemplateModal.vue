<script setup>
import { computed, reactive, ref, watch } from "vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import { extractTemplateVariables, getTemplateVariableOptions, renderTemplate } from "../utils/templateVariables";
import { ALLOWED_REFERENCE_TYPES, CHANNELS, calculateEstimatedCost, getDatabaseSession, normalizeReference, recordTemplateUse } from "../services/responseTemplates.service";

const props = defineProps({ open: Boolean, template: Object, currentUser: Object });
const emit = defineEmits(["close", "saved", "error"]);
const saving = ref(false); const errors = ref({}); const values = reactive({});
const form = reactive({ recipient_name:"", recipient_contact:"", reference_type:"", reference_id:"", channel:"copy", duration_minutes:"", hourly_rate:"", currency:"MXN", notes:"" });
const variableNames = computed(() => extractTemplateVariables(`${props.template?.subject || ""} ${props.template?.content || ""}`));
const options = computed(() => Object.fromEntries(getTemplateVariableOptions(props.template?.language).map((item) => [item.key, item])));
const subject = computed(() => renderTemplate(props.template?.subject || "", values).message);
const content = computed(() => renderTemplate(props.template?.content || "", values).message);
const estimatedCost = computed(() => calculateEstimatedCost(form.duration_minutes, form.hourly_rate));

watch(() => props.open, (open) => {
  if (!open) return;
  Object.keys(values).forEach((key) => delete values[key]);
  Object.assign(form, { recipient_name:"", recipient_contact:"", reference_type:"", reference_id:"", channel:props.template?.channels?.[0] || "copy", duration_minutes:"", hourly_rate:"", currency:props.template?.region === "USA" ? "USD" : "MXN", notes:"" });
  errors.value = {};
});

function validate() {
  const next = {}; const minutes = Number(form.duration_minutes); const rate = Number(form.hourly_rate);
  if (!props.template?.id) next.template = "Selecciona una plantilla";
  if (!content.value.trim()) next.content = "El contenido final es obligatorio";
  if (!CHANNELS.includes(form.channel)) next.channel = "Selecciona un canal";
  if (!Number.isFinite(minutes) || minutes <= 0) next.duration_minutes = "Ingresa un tiempo mayor que cero";
  if (!Number.isFinite(rate) || rate < 0) next.hourly_rate = "Ingresa una tarifa válida";
  if (!["MXN", "USD"].includes(form.currency)) next.currency = "Selecciona una moneda";
  errors.value = next; return !Object.keys(next).length;
}
async function submit() {
  if (saving.value || !validate()) return;
  saving.value = true;
  try {
    const session = await getDatabaseSession();
    const user = session?.user || props.currentUser || null;
    const normalizedReference = normalizeReference(form.reference_type, form.reference_id);
    const result = await recordTemplateUse({
      template_id: props.template.id, user_id: session?.user?.id || null,
      user_name: user?.user_metadata?.name || user?.name || "Administrador", user_email: user?.email || "admin@dev.local",
      reference_type: normalizedReference.reference_type, reference_id: normalizedReference.reference_id,
      recipient_name: form.recipient_name.trim() || null, recipient_contact: form.recipient_contact.trim() || null,
      channel: form.channel, rendered_subject: subject.value.trim() || null, rendered_content: content.value.trim(),
      variables_payload: { ...values }, duration_minutes: Number(form.duration_minutes), hourly_rate: Number(form.hourly_rate),
      currency: form.currency, notes: form.notes.trim() || null, action:"used", delivery_status:"prepared", used_at:new Date().toISOString(),
    });
    emit("saved", result);
  } catch (error) { emit("error", error); } finally { saving.value = false; }
}
</script>

<template>
  <BaseModal :open="open" title="Usar plantilla" hide-footer max-width="960px" @close="emit('close')">
    <form class="usage-form" @submit.prevent="submit">
      <p class="template-name"><strong>{{ template?.name }}</strong> · {{ template?.category }}</p>
      <div class="grid">
        <label><span>Cliente o prospecto</span><input v-model="form.recipient_name" /></label>
        <label><span>Medio de contacto</span><input v-model="form.recipient_contact" /></label>
        <label><span>Tipo de referencia</span><select v-model="form.reference_type"><option value="">Sin referencia</option><option v-for="item in ALLOWED_REFERENCE_TYPES" :key="item" :value="item">{{ {lead:'Lead',client:'Cliente',quotation:'Cotización',flight:'Vuelo',aircraft:'Aeronave',part:'Parte'}[item] }}</option></select></label>
        <label><span>ID de referencia</span><input v-model="form.reference_id" /></label>
        <label><span>Canal *</span><select v-model="form.channel"><option v-for="item in template?.channels || []" :key="item" :value="item">{{ item }}</option></select><small v-if="errors.channel">{{ errors.channel }}</small></label>
        <label><span>Moneda *</span><select v-model="form.currency"><option>MXN</option><option>USD</option></select></label>
        <label><span>Tiempo empleado (minutos) *</span><input v-model="form.duration_minutes" type="number" min="1" step="1" /><small v-if="errors.duration_minutes">{{ errors.duration_minutes }}</small></label>
        <label><span>Tarifa por hora *</span><input v-model="form.hourly_rate" type="number" min="0" step="0.01" /><small v-if="errors.hourly_rate">{{ errors.hourly_rate }}</small></label>
      </div>
      <section v-if="variableNames.length" class="variables"><h4>Variables detectadas</h4><div class="grid"><label v-for="name in variableNames" :key="name"><span>{{ options[name]?.label || name }}</span><input v-model="values[name]" /></label></div></section>
      <section class="rendered"><label v-if="template?.subject"><span>Asunto renderizado</span><textarea :value="subject" rows="2" readonly /></label><label><span>Contenido final *</span><textarea :value="content" rows="7" readonly /></label></section>
      <label><span>Observaciones</span><textarea v-model="form.notes" rows="3" /></label>
      <div class="cost"><span>Costo estimado</span><strong>{{ estimatedCost.toFixed(2) }} {{ form.currency }}</strong><small>Referencia visual; Supabase calcula el costo definitivo.</small></div>
      <div class="actions"><BaseButton variant="secondary" @click="emit('close')">Cancelar</BaseButton><BaseButton type="submit" :disabled="saving">{{ saving ? 'Registrando…' : 'Registrar uso' }}</BaseButton></div>
    </form>
  </BaseModal>
</template>

<style scoped>
.usage-form{max-height:75vh;overflow:auto;padding-right:4px}.template-name{margin-top:0;color:var(--text-muted)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.usage-form label>span{display:block;margin:7px 0 5px;color:var(--text-muted);font-size:.78rem;font-weight:800}.usage-form input,.usage-form select,.usage-form textarea{padding:10px 12px}.variables,.rendered,.cost{margin-top:16px;padding:15px;border:1px solid var(--border-color);border-radius:15px;background:var(--bg-soft)}.variables h4{margin:0 0 8px}.rendered textarea{width:100%;resize:vertical}.cost{display:flex;flex-direction:column;gap:5px}.cost strong{font-size:1.5rem;color:var(--text-strong)}small{color:var(--danger)}.cost small{color:var(--text-faint)}.actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}@media(max-width:760px){.usage-form{max-height:none}.grid{grid-template-columns:1fr}.actions{flex-direction:column-reverse}.actions>*{width:100%}}
</style>
