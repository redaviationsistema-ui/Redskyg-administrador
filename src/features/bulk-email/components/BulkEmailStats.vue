<script setup>
import StatCard from "@/components/ui/StatCard.vue";

defineProps({
  stats: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="stats-grid">
    <StatCard title="Total de campañas" :value="stats.totalCampaigns" hint="Registros disponibles" />
    <StatCard title="Borradores" :value="stats.drafts" hint="Pendientes de configuración" />
    <StatCard title="Programadas" :value="stats.scheduled" hint="En espera de envío" />
    <StatCard title="En proceso" :value="stats.processing" hint="Campañas activas" />
    <StatCard title="Completadas" :value="stats.completed" hint="Envíos finalizados" />
    <StatCard title="Correos enviados" :value="stats.sent" hint="Total acumulado" />
    <StatCard title="Correos fallidos" :value="stats.failed" hint="Errores de entrega" />
    <StatCard title="Cancelaciones" :value="stats.cancellations" hint="Bajas o cancelaciones" />
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 540px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
