<script setup>
import BaseButton from "@/components/ui/BaseButton.vue";
import BulkEmailStatusBadge from "./BulkEmailStatusBadge.vue";

defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  loading: Boolean,
  error: {
    type: String,
    default: "",
  },
  page: {
    type: Number,
    default: 1,
  },
  totalPages: {
    type: Number,
    default: 1,
  },
  busyId: {
    type: [String, Number],
    default: null,
  },
  busyType: {
    type: String,
    default: "",
  },
  deletingId: {
    type: [String, Number],
    default: null,
  },
});

const emit = defineEmits([
  "view",
  "edit",
  "duplicate",
  "send-test",
  "start",
  "pause",
  "resume",
  "cancel",
  "delete",
  "progress",
  "page-change",
]);
</script>

<template>
  <section class="campaigns-card">
    <div v-if="loading" class="state-box">Cargando campañas...</div>
    <div v-else-if="error" class="state-box state-error">{{ error }}</div>
    <div v-else-if="!rows.length" class="state-box">Sin campañas registradas.</div>
    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre interno</th>
              <th>Asunto</th>
              <th>Estado</th>
              <th>Destinatarios</th>
              <th>Enviados</th>
              <th>Fallidos</th>
              <th>Pendientes</th>
              <th>Fecha de creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <strong>{{ row.internal_name }}</strong>
                <small class="column-note">Sin columna dedicada; se usa el asunto actual</small>
              </td>
              <td>{{ row.subject }}</td>
              <td><BulkEmailStatusBadge :status="row.status" /></td>
              <td>{{ row.total_recipients || 0 }}</td>
              <td>{{ row.sent_count || 0 }}</td>
              <td>{{ row.failed_count || 0 }}</td>
              <td>{{ row.pending_count || 0 }}</td>
              <td>{{ row.created_at ? new Date(row.created_at).toLocaleString("es-MX") : "-" }}</td>
              <td>
                <div class="actions-cell">
                  <BaseButton :disabled="busyId === row.id" @click="emit('start', row)">
                    {{ busyId === row.id && busyType === "start" ? "Enviando..." : "Enviar correo" }}
                  </BaseButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <BaseButton variant="secondary" :disabled="page <= 1" @click="emit('page-change', page - 1)">
          Anterior
        </BaseButton>
        <span>Página {{ page }} de {{ totalPages }}</span>
        <BaseButton variant="secondary" :disabled="page >= totalPages" @click="emit('page-change', page + 1)">
          Siguiente
        </BaseButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.campaigns-card {
  display: grid;
  gap: 14px;
}

.state-box {
  padding: 24px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  text-align: center;
  color: var(--text-muted);
}

.state-error {
  color: var(--danger);
}

.table-wrap {
  overflow-x: auto;
}

.column-note {
  display: block;
  margin-top: 4px;
  color: var(--text-faint);
}

.actions-cell {
  min-width: 340px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination span {
  color: var(--text-muted);
  font-weight: 700;
}

@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
}
</style>



