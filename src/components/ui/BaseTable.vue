<script setup>
defineProps({
  rows: { type: Array, required: true },
});
</script>

<template>
  <div class="base-table-wrap">
    <table class="base-table">
      <thead>
        <tr>
          <slot name="columns" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <slot name="row" :row="row" />
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.base-table-wrap {
  width: 100%;
  overflow-x: auto;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-sm);
}

.base-table {
  width: 100%;
  border-collapse: collapse;
}

:slotted(th) {
  padding: 14px 16px;
  background: linear-gradient(180deg, #0e2239 0%, #102944 100%);
  color: white;
  text-align: left;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

:slotted(td) {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-main);
}
</style>
