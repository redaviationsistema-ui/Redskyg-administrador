<script setup>
const props = defineProps({
  status: {
    type: String,
    default: "abierta",
  },
  editable: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["change"]);

function onChange(event) {
  emit("change", event.target.value);
}

function statusClass(value) {
  return `status-${String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")}`;
}

function statusLabel(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const progressMap = {
    abierta: 0,
    pendiente: 0,
    contactado: 10,
    cotizando: 20,
    cotizado: 30,
    "solicitada proveedor": 40,
    "pendiente proveedor": 40,
    "enviada cliente": 50,
    "en negociacion": 60,
    aceptada: 70,
    "vuelo vendido": 80,
    ganada: 90,
    facturada: 95,
    pagada: 100,
    "no aceptada": 0,
    perdida: 0,
    cancelada: 0,
  };

  const label = String(value || "")
    .split(" ")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");

  return `${label} - ${progressMap[normalizedValue] ?? 0}%`;
}
</script>

<template>
  <label v-if="editable" class="status-editor" :class="statusClass(status)">
    <span>Estatus</span>
    <select :value="status" @change="onChange">
      <option v-for="option in options" :key="option" :value="option">
        {{ statusLabel(option) }}
      </option>
    </select>
  </label>

  <span v-else class="status-pill" :class="statusClass(status)">
    {{ statusLabel(status) }}
  </span>
</template>

<style scoped>
.status-pill,
.status-editor {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.status-editor {
  flex-wrap: wrap;
  background: var(--bg-soft);
}

.status-editor span {
  color: var(--text-muted);
}

.status-editor select {
  min-width: 180px;
  border-radius: 999px;
  padding: 8px 12px;
}

.status-abierta,
.status-en-negociacion {
  background: rgba(15, 95, 166, 0.12);
  color: #0f5fa6;
}

.status-pendiente-proveedor {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
}

.status-aceptada,
.status-vuelo-vendido {
  background: rgba(22, 163, 74, 0.14);
  color: #166534;
}

.status-perdida {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}
</style>
