<script setup>
import { ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["add"]);
const note = ref("");

function submit() {
  emit("add", note.value);
  note.value = "";
}
</script>

<template>
  <section class="panel card">
    <div class="header">
      <h4>Notas internas</h4>
      <BaseButton variant="secondary" @click="submit">Agregar nota</BaseButton>
    </div>

    <textarea v-model="note" rows="3" placeholder="Observaciones internas, riesgos o acuerdos"></textarea>

    <div class="notes">
      <article v-for="item in items" :key="item.id" class="note">
        <strong>{{ item.author }}</strong>
        <p>{{ item.text }}</p>
        <span>{{ new Date(item.createdAt).toLocaleString("es-MX") }}</span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 22px;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.header h4 {
  margin: 0;
}

textarea {
  min-height: 90px;
  padding: 14px;
  resize: vertical;
}

.notes {
  display: grid;
  gap: 12px;
}

.note {
  padding: 14px;
  border-radius: 16px;
  background: var(--bg-soft);
}

.note p,
.note span {
  margin: 6px 0 0;
  color: var(--text-muted);
}

.note span {
  font-size: 0.8rem;
}
</style>
