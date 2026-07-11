<script setup>
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseTable from "@/components/ui/BaseTable.vue";

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
  rowAction: {
    type: Object,
    default: () => ({ id: null, type: "" }),
  },
});

const emit = defineEmits([
  "preview",
  "edit",
  "toggle",
  "downloads",
  "delete",
  "page-change",
]);
</script>

<template>
  <div class="table-shell">
    <div v-if="loading" class="table-state">Cargando lookbooks...</div>
    <div v-else-if="error" class="table-state table-state-error">{{ error }}</div>
    <div v-else-if="!rows.length" class="table-state">Sin registros.</div>
    <template v-else>
      <BaseTable :rows="rows">
        <template #columns>
          <th>Portada</th>
          <th>Título</th>
          <th>Aeronave</th>
          <th>Categoría</th>
          <th>Estado</th>
          <th>Acceso</th>
          <th>Descargas</th>
          <th>Orden</th>
          <th>Acciones</th>
        </template>

        <template #row="{ row }">
          <td>
            <div class="cover-cell">
              <img v-if="row.cover_preview_url" :src="row.cover_preview_url" :alt="row.title" />
              <div v-else class="cover-fallback">Sin portada</div>
            </div>
          </td>
          <td>
            <div class="title-cell">
              <strong>{{ row.title }}</strong>
              <span>{{ row.slug }}</span>
            </div>
          </td>
          <td>{{ row.aircraft_name || "Sin asignar" }}</td>
          <td>{{ row.category || "Sin categoría" }}</td>
          <td>
            <span :class="['status-badge', row.is_active ? 'status-active' : 'status-inactive']">
              {{ row.is_active ? "Activo" : "Inactivo" }}
            </span>
          </td>
          <td>
            <span :class="['status-badge', row.requires_login ? 'status-protected' : 'status-public']">
              {{ row.requires_login ? "Protegido" : "Público" }}
            </span>
          </td>
          <td>{{ row.downloads_count || 0 }}</td>
          <td>{{ row.order_index ?? "-" }}</td>
          <td>
            <div class="actions-cell">
              <BaseButton
                variant="secondary"
                :disabled="rowAction.id === row.id"
                @click="emit('preview', row)"
              >
                {{ rowAction.id === row.id && rowAction.type === "preview" ? "Abriendo..." : "Ver" }}
              </BaseButton>
              <BaseButton
                variant="secondary"
                :disabled="rowAction.id === row.id"
                @click="emit('edit', row)"
              >
                Editar
              </BaseButton>
              <BaseButton
                :variant="row.is_active ? 'secondary' : 'success'"
                :disabled="rowAction.id === row.id"
                @click="emit('toggle', row)"
              >
                {{
                  rowAction.id === row.id && rowAction.type === "toggle"
                    ? "Actualizando..."
                    : row.is_active
                      ? "Desactivar"
                      : "Activar"
                }}
              </BaseButton>
              <BaseButton
                variant="secondary"
                :disabled="rowAction.id === row.id"
                @click="emit('downloads', row)"
              >
                Descargas
              </BaseButton>
              <BaseButton
                variant="danger"
                :disabled="rowAction.id === row.id"
                @click="emit('delete', row)"
              >
                {{ rowAction.id === row.id && rowAction.type === "delete" ? "Eliminando..." : "Eliminar" }}
              </BaseButton>
            </div>
          </td>
        </template>
      </BaseTable>

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
  </div>
</template>

<style scoped>
.table-shell {
  display: grid;
  gap: 16px;
}

.table-state {
  padding: 26px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  color: var(--text-muted);
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.table-state-error {
  color: var(--danger);
}

.cover-cell {
  width: 92px;
  height: 64px;
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-soft);
  border: 1px solid var(--border-color);
}

.cover-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.74rem;
  color: var(--text-faint);
  font-weight: 700;
}

.title-cell {
  display: grid;
  gap: 4px;
}

.title-cell strong {
  color: var(--text-strong);
}

.title-cell span {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 800;
}

.status-active {
  background: rgba(21, 128, 61, 0.12);
  color: var(--success);
}

.status-inactive {
  background: rgba(217, 119, 6, 0.12);
  color: var(--warning);
}

.status-protected {
  background: rgba(15, 95, 166, 0.12);
  color: var(--primary);
}

.status-public {
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-main);
}

.actions-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 320px;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 4px;
}

.pagination span {
  color: var(--text-muted);
  font-weight: 700;
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
