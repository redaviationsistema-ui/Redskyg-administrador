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
const detail = ref("");

function submit() {
  emit("add", detail.value);
  detail.value = "";
}
</script>

<template>
  <section class="panel card">
    <div class="header">
      <h4>Timeline comercial</h4>
      <BaseButton variant="secondary" @click="submit">Registrar seguimiento</BaseButton>
    </div>

    <textarea v-model="detail" rows="3" placeholder="Seguimiento, llamada, respuesta del cliente o proveedor"></textarea>

    <div class="list">
      <article v-for="item in items" :key="item.id" class="item">
        <div class="dot"></div>
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.detail }}</p>
          <span>{{ new Date(item.createdAt).toLocaleString("es-MX") }}</span>
        </div>
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
  color: var(--text-strong);
}

textarea {
  min-height: 90px;
  padding: 14px;
  resize: vertical;
}

.list {
  display: grid;
  gap: 14px;
}

.item {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 12px;
}

.item p,
.item span {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.item span {
  display: block;
  font-size: 0.8rem;
}

.dot {
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  box-shadow: 0 0 0 6px rgba(15, 95, 166, 0.1);
}
</style>
