<script setup>
import BaseButton from "@/components/ui/BaseButton.vue";

defineProps({
  row: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  "view",
  "edit",
  "duplicate",
  "email",
  "pdf",
  "follow-up",
  "note",
  "attachment",
  "delete",
]);
</script>

<template>
  <div class="actions">
    <BaseButton variant="secondary" @click="emit('view', row)">Ver</BaseButton>
    <BaseButton variant="secondary" @click="emit('edit', row)">Editar</BaseButton>
    <button type="button" class="text-action" @click="emit('duplicate', row)">Duplicar</button>
    <button type="button" class="text-action" @click="emit('email', row)">Correo</button>
    <button type="button" class="text-action" @click="emit('pdf', row)">PDF</button>
    <button type="button" class="text-action" @click="emit('follow-up', row)">Seguimiento</button>
    <button type="button" class="text-action" @click="emit('note', row)">Nota</button>
    <button type="button" class="text-action" @click="emit('attachment', row)">Archivo</button>
    <button type="button" class="text-action danger" @click="emit('delete', row)">Eliminar</button>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.text-action {
  min-height: 38px;
  padding: 0 10px;
  border-radius: 12px;
  background: transparent;
  color: var(--primary);
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.danger {
  color: var(--danger);
}
</style>
