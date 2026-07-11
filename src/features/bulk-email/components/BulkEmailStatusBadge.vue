<script setup>
import { computed } from "vue";

const props = defineProps({
  status: {
    type: String,
    default: "",
  },
});

const normalizedStatus = computed(() => String(props.status || "draft").toLowerCase());
const label = computed(() => {
  switch (normalizedStatus.value) {
    case "scheduled":
    case "programada":
      return "Programada";
    case "processing":
    case "in_progress":
    case "sending":
      return "En proceso";
    case "completed":
    case "sent":
    case "finished":
      return "Completada";
    case "paused":
      return "Pausada";
    case "cancelled":
    case "canceled":
      return "Cancelada";
    default:
      return "Borrador";
  }
});
</script>

<template>
  <span :class="['status-badge', `status-${normalizedStatus}`]">
    {{ label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 800;
  background: rgba(15, 23, 42, 0.08);
  color: var(--text-main);
}

.status-draft {
  background: rgba(15, 23, 42, 0.08);
}

.status-scheduled,
.status-programada {
  background: rgba(217, 119, 6, 0.14);
  color: var(--warning);
}

.status-processing,
.status-in_progress,
.status-sending {
  background: rgba(15, 95, 166, 0.14);
  color: var(--primary);
}

.status-completed,
.status-sent,
.status-finished {
  background: rgba(21, 128, 61, 0.14);
  color: var(--success);
}

.status-paused {
  background: rgba(107, 114, 128, 0.16);
  color: var(--text-muted);
}

.status-cancelled,
.status-canceled {
  background: rgba(198, 40, 40, 0.14);
  color: var(--danger);
}
</style>
