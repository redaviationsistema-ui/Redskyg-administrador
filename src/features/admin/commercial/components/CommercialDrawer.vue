<script setup>
defineProps({
  open: Boolean,
  title: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close"]);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="drawer-overlay" @click.self="emit('close')">
      <aside class="drawer">
        <header class="drawer-header">
          <div>
            <p class="eyebrow">Centro Comercial</p>
            <h3>{{ title }}</h3>
          </div>
          <button type="button" class="close-btn" @click="emit('close')">Cerrar</button>
        </header>

        <div class="drawer-content">
          <slot />
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  background: var(--bg-soft);
}

.drawer {
  width: 100vw;
  max-width: none;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top right, rgba(15, 95, 166, 0.12), transparent 24%),
    linear-gradient(180deg, var(--bg-surface-solid), var(--bg-soft));
  box-shadow: none;
}

.drawer-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--primary);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.drawer-header h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.45rem;
}

.close-btn {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  background: var(--bg-surface-solid);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  font-weight: 700;
  cursor: pointer;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
</style>
