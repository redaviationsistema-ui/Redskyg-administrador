<script setup>
defineProps({
  title: String,
  value: [String, Number],
  hint: { type: String, default: "" },
});
</script>

<template>
  <div class="stat-card">
    <span class="stat-title">{{ title }}</span>
    <strong class="stat-value">{{ value }}</strong>
    <span v-if="hint" class="stat-hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: linear-gradient(180deg, var(--bg-surface-solid) 0%, var(--bg-soft) 100%);
  box-shadow: var(--shadow-sm);
}

.stat-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-strong);
  line-height: 1.1;
}

.stat-hint {
  color: var(--text-muted);
  font-size: 0.86rem;
}
</style>
