<script setup>
import { computed } from "vue";
import { statusLabels, tripLabels } from "@/utils/whatsappDisplay";
const props = defineProps({ conversation: { type: Object, required: true }, summary: { type: String, default: "" } });
const flight = computed(() => props.conversation.flight_request);
const display = (value) => typeof value === "boolean" ? (value ? "Sí" : "No") : value;
const groups = computed(() => {
  const f = flight.value || {};
  return [
    { title: "Cliente", rows: [["Nombre", f.client_name || props.conversation.contact?.name], ["Teléfono", props.conversation.contact?.phone_number], ["Correo", f.client_email], ["Empresa", f.company]] },
    { title: "Vuelo", rows: [["Origen", f.origin], ["Destino", f.destination], ["Salida", f.departure_date], ["Hora", f.departure_time], ["Pasajeros", f.passengers], ["Viaje", tripLabels[f.trip_type]], ["Regreso", f.return_date], ["Hora de regreso", f.return_time]] },
    { title: "Detalles", rows: [["Piezas de equipaje", f.luggage_count], ["Equipaje", f.luggage_description], ["Equipaje especial", f.special_luggage], ["Mascotas", f.has_pets], ["Detalle mascotas", f.pets_description], ["Horario flexible", f.is_time_flexible], ["Aeronave", f.aircraft_preference], ["Aeropuertos alternos", f.allow_alternate_airports], ["Catering", f.catering_required], ["Transporte terrestre", f.ground_transport_required], ["Wi-Fi", f.wifi_required], ["Otros servicios", f.other_services], ["Presupuesto", f.budget], ["Observaciones", f.notes], ["Aeronave seleccionada", f.selected_aircraft], ["Referencia", f.quote_reference]] },
  ].map((group) => ({ ...group, rows: group.rows.filter(([, value]) => value !== null && value !== undefined && value !== "") })).filter((group) => group.rows.length);
});
</script>

<template>
  <aside class="flight-panel" aria-label="Solicitud de vuelo">
    <h2>Solicitud de vuelo</h2>
    <span v-if="flight" class="status">{{ statusLabels[flight.status] || flight.status }}</span>
    <p v-else class="muted">Aún no hay una solicitud de vuelo.</p>
    <section v-for="group in groups" :key="group.title">
      <h3>{{ group.title }}</h3>
      <dl><template v-for="[label, value] in group.rows" :key="label"><dt>{{ label }}</dt><dd>{{ display(value) }}</dd></template></dl>
    </section>
    <section v-if="flight?.legs?.length">
      <h3>Tramos adicionales</h3>
      <p v-for="(leg, index) in flight.legs" :key="index"><strong>{{ index + 2 }}. {{ leg.origin }} → {{ leg.destination }}</strong><br>{{ leg.departure_date }} · {{ leg.departure_time }}</p>
    </section>
    <details v-if="summary"><summary>Ver resumen de cotización</summary><p class="summary">{{ summary }}</p></details>
  </aside>
</template>

<style scoped>
.flight-panel { padding: 20px; overflow: auto; background: var(--bg-surface-solid); }
h2 { margin: 0 0 12px; font-size: 1.1rem; } h3 { font-size: .85rem; color: var(--text-muted); margin: 20px 0 12px; }
section + section { border-top: 1px solid var(--border-color); margin-top: 18px; }
dl { display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; font-size: .85rem; } dt { color: var(--text-muted); } dd { margin: 0; overflow-wrap: anywhere; }
.status { display: inline-block; border-radius: 20px; background: var(--primary-soft); color: var(--primary); padding: 6px 10px; font-size: .8rem; font-weight: 700; }
.muted { color: var(--text-muted); } .summary { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .85rem; } details { margin-top: 22px; } summary { cursor: pointer; color: var(--primary); }
</style>
