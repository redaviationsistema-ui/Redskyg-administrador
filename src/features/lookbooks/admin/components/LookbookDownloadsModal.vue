<script setup>
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";

defineProps({
  open: Boolean,
  lookbook: {
    type: Object,
    default: null,
  },
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
  total: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["close", "page-change"]);

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="lookbook ? `Descargas de ${lookbook.title}` : 'Descargas'"
    max-width="980px"
    hide-footer
    @close="emit('close')"
  >
    <div class="downloads-modal">
      <p v-if="lookbook" class="modal-copy">
        Total registrado: <strong>{{ total }}</strong>
      </p>

      <div v-if="loading" class="state-box">Cargando historial de descargas...</div>
      <div v-else-if="error" class="state-box state-error">{{ error }}</div>
      <div v-else-if="!rows.length" class="state-box">Sin registros.</div>
      <template v-else>
        <div class="downloads-table-wrap">
          <table class="downloads-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Correo</th>
                <th>Usuario autenticado</th>
                <th>IP</th>
                <th>Navegador o dispositivo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ formatDate(row.downloaded_at) }}</td>
                <td>{{ row.email || "-" }}</td>
                <td>{{ row.user_id || "-" }}</td>
                <td>{{ row.ip_address || "-" }}</td>
                <td class="user-agent">{{ row.user_agent || "-" }}</td>
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

      <div class="footer-actions">
        <BaseButton variant="secondary" @click="emit('close')">Cerrar</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.downloads-modal {
  display: grid;
  gap: 16px;
}

.modal-copy {
  margin: 0;
  color: var(--text-muted);
}

.state-box {
  padding: 22px;
  border-radius: 18px;
  background: var(--bg-soft);
  border: 1px solid var(--border-color);
  text-align: center;
  color: var(--text-muted);
}

.state-error {
  color: var(--danger);
}

.downloads-table-wrap {
  overflow-x: auto;
  border-radius: 18px;
  border: 1px solid var(--border-color);
}

.downloads-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-surface-solid);
}

.downloads-table thead {
  background: linear-gradient(180deg, #0e2239 0%, #102944 100%);
  color: #fff;
}

.downloads-table th,
.downloads-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
  vertical-align: top;
}

.downloads-table th {
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.downloads-table td {
  font-size: 0.88rem;
}

.user-agent {
  min-width: 240px;
  word-break: break-word;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.pagination span {
  color: var(--text-muted);
  font-weight: 700;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination span {
    text-align: center;
  }
}
</style>
