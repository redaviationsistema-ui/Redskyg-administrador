<script setup>
import { ref } from 'vue';
import { supabaseInventory } from '../supabase';
import { useFeedback } from '../composables/useFeedback';
import { appendAvailabilityRecord, createAvailabilitySender, postAvailabilityEmail } from '../utils/availabilityConfirmationEmail.js';

const props = defineProps({ quoteId: { type: [String, Number], required: true } });
const emit = defineEmits(['record-saved']);
const sending = ref(false);
const feedback = useFeedback();
const send = createAvailabilitySender({
  loadQuote: async (id) => {
    const { data, error } = await supabaseInventory.from('quotes').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) throw new Error('No se encontró la cotización.');
    return data;
  },
  send: (payload) => postAvailabilityEmail(payload, {
    endpoint: import.meta.env.VITE_AVAILABILITY_CONFIRMATION_ENDPOINT || 'https://redskyg.com/administrador/send_quote_v3.php',
  }),
  saveRecord: (id, payload) => appendAvailabilityRecord(supabaseInventory, id, payload),
});

async function onClick() {
  if (sending.value) return;
  sending.value = true;
  try {
    const result = await send(props.quoteId);
    emit('record-saved', result.quote);
    await feedback.success('Confirmación enviada', 'Correo enviado y registro guardado correctamente.');
  } catch (error) {
    if (error.emailSent) {
      console.error('[Availability Confirmation] Error al guardar registro', error.cause);
      await feedback.warning('Correo enviado; registro pendiente', error.message);
      return;
    }
    console.log('[Availability Confirmation] Error al enviar', {
      message: error.message,
      name: error.name,
      ...error.diagnostics,
    });
    await feedback.error('No se pudo enviar la confirmación', error);
  } finally { sending.value = false; }
}
</script>

<template>
  <button type="button" class="availability-confirmation-btn" :disabled="sending" :aria-busy="sending"
    :title="sending ? 'Enviando...' : 'Enviar confirmación de disponibilidad'"
    aria-label="Enviar confirmación de disponibilidad" @click="onClick">
    <span v-if="sending" class="sending-label" role="status">Enviando...</span>
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>
  </button>
</template>

<style scoped>
.availability-confirmation-btn { width:40px;height:40px;padding:0;border:0;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:#e0e7ff;color:#3730a3;cursor:pointer; }
.availability-confirmation-btn svg { width:16px;height:16px; }
.availability-confirmation-btn:disabled { cursor:wait;opacity:.65;width:auto;grid-column:span 2; }
.sending-label { font-size:11px;padding:0 4px; }
@media(max-width:768px) { .availability-confirmation-btn { width:100%;height:22px;border-radius:7px; }.availability-confirmation-btn svg { width:12px;height:12px; } }
</style>
