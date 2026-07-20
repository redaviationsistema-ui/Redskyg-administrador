<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["add", "remove"]);

function onFileChange(event) {
  const [file] = event.target.files || [];
  emit("add", file || null);
  event.target.value = "";
}
</script>

<template>
  <section class="panel card">
    <div class="header">
      <h4>Archivos</h4>
      <label class="upload-btn">
        <input type="file" @change="onFileChange" />
        Subir archivo
      </label>
    </div>

    <div class="files">
      <article v-for="item in items" :key="item.id" class="file">
        <div>
          <strong>{{ item.name }}</strong>
          <p>{{ item.sizeLabel }} · {{ item.type }}</p>
          <span>{{ new Date(item.createdAt).toLocaleString("es-MX") }}</span>
        </div>
        <button type="button" class="remove-btn" @click="emit('remove', item.id)">Quitar</button>
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

.upload-btn {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 14px;
  background: var(--bg-surface-solid);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
}

.upload-btn input {
  display: none;
}

.files {
  display: grid;
  gap: 12px;
}

.file {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  background: var(--bg-soft);
}

.file p,
.file span {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.file span {
  font-size: 0.8rem;
}

.remove-btn {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  background: transparent;
  color: var(--danger);
  font-weight: 700;
  cursor: pointer;
}
</style>
