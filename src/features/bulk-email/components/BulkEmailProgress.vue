<script setup>
const props = defineProps({
  progress: {
    type: Object,
    default: null,
  },
  loading: Boolean,
  error: {
    type: String,
    default: "",
  },
});

function resolveNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function resolvePercent(progress) {
  if (!progress) {
    return 0;
  }

  return resolveNumber(progress.percent, progress.percentage, progress.progress);
}
</script>

<template>
  <section class="progress-card">
    <header>
      <h3>Progreso del envío</h3>
      <span v-if="loading">Actualizando...</span>
    </header>

    <p v-if="error" class="error-text">{{ error }}</p>

    <template v-else>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${resolvePercent(progress)}%` }"></div>
      </div>

      <div class="progress-grid">
        <article>
          <span>Porcentaje</span>
          <strong>{{ resolvePercent(progress) }}%</strong>
        </article>
        <article>
          <span>Enviados</span>
          <strong>{{ resolveNumber(progress?.sent, progress?.sent_count) }}</strong>
        </article>
        <article>
          <span>Fallidos</span>
          <strong>{{ resolveNumber(progress?.failed, progress?.failed_count) }}</strong>
        </article>
        <article>
          <span>Pendientes</span>
          <strong>{{ resolveNumber(progress?.pending, progress?.pending_count) }}</strong>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.progress-card {
  display: grid;
  gap: 16px;
  padding: 20px;
  border-radius: 22px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-sm);
}

.progress-card header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.progress-card h3 {
  margin: 0;
  color: var(--text-strong);
}

.progress-bar {
  height: 14px;
  border-radius: 999px;
  background: var(--bg-soft);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--primary), var(--primary-strong));
}

.progress-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.progress-grid article {
  padding: 14px;
  border-radius: 16px;
  background: var(--bg-soft);
}

.progress-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.progress-grid strong {
  color: var(--text-strong);
  font-size: 1.15rem;
}

.error-text {
  margin: 0;
  color: var(--danger);
}

@media (max-width: 768px) {
  .progress-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
