<script setup>
import { ref } from "vue";

defineProps({
  filters: {
    type: Object,
    required: true,
  },
  currencyOptions: {
    type: Array,
    default: () => [],
  },
  requestTypeOptions: {
    type: Array,
    default: () => [],
  },
  statusOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["change", "reset"]);
const moreOpen = ref(false);

function emitChange(key, event) {
  emit("change", key, event.target.value);
}

function statusLabel(value) {
  return String(value || "")
    .split(" ")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}
</script>

<template>
  <section class="filters-shell">
    <div class="compact-bar panel">
      <label class="search-field">
        <span>Buscar</span>
        <input
          :value="filters.customer"
          type="search"
          placeholder="Cliente, empresa, ruta o contacto"
          @input="emitChange('customer', $event)"
        />
      </label>

      <label class="select-field">
        <span>Estado</span>
        <select :value="filters.status" @change="emitChange('status', $event)">
          <option value="all">Todos</option>
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ statusLabel(status) }}
          </option>
        </select>
      </label>

      <label class="select-field">
        <span>Proveedor</span>
        <input :value="filters.provider" type="text" placeholder="Proveedor" @input="emitChange('provider', $event)" />
      </label>

      <label class="select-field">
        <span>Fecha</span>
        <input :value="filters.date" type="date" @input="emitChange('date', $event)" />
      </label>

      <div class="toolbar-actions">
        <button type="button" class="ghost-btn" @click="moreOpen = true">Más filtros</button>
        <button type="button" class="ghost-btn" @click="emit('reset')">Limpiar</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="moreOpen" class="drawer-overlay" @click.self="moreOpen = false">
        <aside class="filter-drawer">
          <div class="drawer-head">
            <div>
              <p class="eyebrow">Filtros avanzados</p>
              <h3>Refina el pipeline</h3>
            </div>
            <button type="button" class="close-btn" @click="moreOpen = false">Cerrar</button>
          </div>

          <div class="drawer-grid">
            <label class="field">
              <span>Empresa</span>
              <input :value="filters.company" type="text" @input="emitChange('company', $event)" />
            </label>
            <label class="field">
              <span>Correo</span>
              <input :value="filters.email" type="text" @input="emitChange('email', $event)" />
            </label>
            <label class="field">
              <span>Teléfono</span>
              <input :value="filters.phone" type="text" @input="emitChange('phone', $event)" />
            </label>
            <label class="field">
              <span>Ruta</span>
              <input :value="filters.route" type="text" @input="emitChange('route', $event)" />
            </label>
            <label class="field">
              <span>Origen</span>
              <input :value="filters.origin" type="text" @input="emitChange('origin', $event)" />
            </label>
            <label class="field">
              <span>Destino</span>
              <input :value="filters.destination" type="text" @input="emitChange('destination', $event)" />
            </label>
            <label class="field">
              <span>Aeronave</span>
              <input :value="filters.aircraft" type="text" @input="emitChange('aircraft', $event)" />
            </label>
            <label class="field">
              <span>Moneda</span>
              <select :value="filters.currency" @change="emitChange('currency', $event)">
                <option value="all">Todas</option>
                <option v-for="currency in currencyOptions" :key="currency" :value="currency">
                  {{ currency }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>Precio mínimo</span>
              <input :value="filters.minPrice" type="number" min="0" @input="emitChange('minPrice', $event)" />
            </label>
            <label class="field">
              <span>Precio máximo</span>
              <input :value="filters.maxPrice" type="number" min="0" @input="emitChange('maxPrice', $event)" />
            </label>
            <label class="field">
              <span>Ejecutivo</span>
              <input :value="filters.executive" type="text" @input="emitChange('executive', $event)" />
            </label>
            <label class="field">
              <span>Tipo de solicitud</span>
              <select :value="filters.requestType" @change="emitChange('requestType', $event)">
                <option value="all">Todos</option>
                <option v-for="type in requestTypeOptions" :key="type" :value="type">
                  {{ type }}
                </option>
              </select>
            </label>
          </div>
        </aside>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.filters-shell {
  display: grid;
}

.compact-bar {
  display: grid;
  grid-template-columns: minmax(280px, 1.6fr) repeat(3, minmax(160px, 0.7fr)) auto;
  gap: 12px;
  padding: 14px;
  border-radius: 22px;
  align-items: end;
}

.search-field,
.select-field,
.field {
  display: grid;
  gap: 6px;
}

.search-field span,
.select-field span,
.field span {
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.search-field input,
.select-field input,
.select-field select,
.field input,
.field select {
  padding: 11px 14px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.ghost-btn,
.close-btn {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  background: var(--bg-surface-solid);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  font-weight: 700;
  cursor: pointer;
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  justify-content: flex-end;
  background: rgba(8, 17, 31, 0.36);
  backdrop-filter: blur(4px);
}

.filter-drawer {
  width: min(560px, 100%);
  height: 100vh;
  padding: 22px;
  background:
    radial-gradient(circle at top right, rgba(15, 95, 166, 0.12), transparent 26%),
    linear-gradient(180deg, var(--bg-surface-solid), var(--bg-soft));
  box-shadow: -18px 0 48px rgba(15, 23, 42, 0.16);
  overflow-y: auto;
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.drawer-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.drawer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 1100px) {
  .compact-bar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 700px) {
  .compact-bar,
  .drawer-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    justify-content: space-between;
  }
}
</style>
