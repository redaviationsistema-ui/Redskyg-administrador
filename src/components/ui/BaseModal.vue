<script setup>
import BaseButton from "@/components/ui/BaseButton.vue";

defineProps({
  open: Boolean,
  title: { type: String, default: "Details" },
});

defineEmits(["close"]);
</script>

<template>
  <div v-if="open" class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h3>{{ title }}</h3>
      </div>

      <div class="modal-body">
        <slot />
      </div>

      <div class="actions">
        <BaseButton variant="secondary" @click="$emit('close')">
          Close
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 17, 31, 0.48);
  backdrop-filter: blur(8px);
}

.modal {
  width: min(680px, 100%);
  border-radius: 24px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-head {
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--border-color);
}

.modal-head h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.2rem;
}

.modal-body {
  padding: 24px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 24px 24px;
}
</style>
