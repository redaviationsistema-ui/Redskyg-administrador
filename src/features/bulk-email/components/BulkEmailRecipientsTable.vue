<script setup>
import BaseButton from "@/components/ui/BaseButton.vue";

defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  loading: Boolean,
  page: {
    type: Number,
    default: 1,
  },
  totalPages: {
    type: Number,
    default: 1,
  },
  removable: Boolean,
});

const emit = defineEmits(["page-change", "remove"]);
</script>

<template>
  <section class="recipients-card">
    <div v-if="loading" class="state-box">Cargando destinatarios...</div>
    <div v-else-if="!rows.length" class="state-box">Sin destinatarios.</div>
    <template v-else>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Dominio</th>
              <th>Fecha</th>
              <th v-if="removable">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>{{ row.email }}</td>
              <td>{{ row.name || "-" }}</td>
              <td>{{ row.domain || "-" }}</td>
              <td>{{ row.created_at ? new Date(row.created_at).toLocaleString("es-MX") : "-" }}</td>
              <td v-if="removable">
                <BaseButton variant="secondary" @click="emit('remove', row)">Quitar</BaseButton>
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
.recipients-card {
  display: grid;
  gap: 14px;
}

.state-box {
  padding: 22px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: var(--bg-surface-solid);
  text-align: center;
  color: var(--text-muted);
}

.table-wrap {
  overflow-x: auto;
  border-radius: 20px;
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
