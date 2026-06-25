<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "@/supabase";

import FullCalendar from "@fullcalendar/vue3";
import dayGridPlugin from "@fullcalendar/daygrid";

const calendarOptions = ref({
  plugins: [dayGridPlugin],
  initialView: "dayGridMonth",
  height: "auto",
  timeZone: "America/Mexico_City",
  events: [],
});

onMounted(async () => {
  const { data, error } = await supabase.from("reservations").select(`
      id,
      start_datetime,
      end_datetime,
      status,
      aircraft_fleet ( name )
    `);

  if (error) {
    console.error(error);
    return;
  }

  calendarOptions.value.events = data.map((item) => {
    let backgroundColor = "#2563eb";
    let textColor = "#ffffff";

    switch (item.status) {
      case "confirmed":
        backgroundColor = "#16a34a"; // 🟢 verde
        break;

      case "pending":
        backgroundColor = "#f59e0b"; // 🟡 amarillo
        textColor = "#000000";
        break;

      case "Bloqueo":
        backgroundColor = "#dc2626"; // 🔴 rojo
        break;

      case "Mantenimiento":
        backgroundColor = "#9ca3af"; // ⚪ gris
        break;

      case "Inspección":
        backgroundColor = "#6366f1"; // 🔵 azul
        break;

      case "Operación Especial":
        backgroundColor = "#10b981"; // 🟢 verde especial
        break;
    }

    return {
      title: `${item.aircraft_fleet?.name || "Aircraft"} - ${item.status}`,
      start: item.start_datetime,
      end: item.end_datetime,
      backgroundColor,
      borderColor: backgroundColor,
      textColor,
    };
  });
});
</script>
<template>
  <RouterLink to="/blocked-dates/create" class="add-btn">
    + Bloquear Fecha
  </RouterLink>
  <section class="calendar-section">
    <h2>Calendario de Fechas Bloqueadas</h2>
    <FullCalendar :options="calendarOptions" />
  </section>
</template>
<style scoped>
.add-btn {
  display: inline-block;
  margin-bottom: 20px;
  background: #2563eb;
  color: white;
  padding: 8px 14px;
  border-radius: 6px;
  text-decoration: none;
}

/* 🔥 Texto más pequeño en eventos */
:deep(.fc-daygrid-event) {
  font-size: 9px !important;
  padding: 1px 3px !important;
}

:deep(.fc-event-title) {
  font-size: 9px !important;
}
</style>
