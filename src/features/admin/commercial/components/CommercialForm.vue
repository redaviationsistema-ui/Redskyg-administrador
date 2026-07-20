<script setup>
import { computed, reactive, toRaw, watch } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";

const props = defineProps({
  initialValue: {
    type: Object,
    required: true,
  },
  mode: {
    type: String,
    default: "view",
  },
  saving: Boolean,
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

const emit = defineEmits(["submit"]);

const form = reactive({});

function clonePlain(value) {
  const source = value ? toRaw(value) : {};
  return JSON.parse(JSON.stringify(source));
}

function syncForm() {
  Object.keys(form).forEach((key) => {
    delete form[key];
  });
  Object.assign(form, clonePlain(props.initialValue));
}

watch(() => props.initialValue, syncForm, { immediate: true, deep: true });

const isReadOnly = computed(() => props.mode === "view");

function handleSubmit() {
  emit("submit", clonePlain(form));
}
</script>

<template>
  <form class="commercial-form" @submit.prevent="handleSubmit">
    <div class="grid">
      <label class="field">
        <span>Folio</span>
        <input v-model="form.folio" :disabled="isReadOnly" type="text" placeholder="CC-2026-001" />
      </label>

      <label class="field">
        <span>Fecha</span>
        <input v-model="form.createdAt" :disabled="isReadOnly" type="date" />
      </label>

      <label class="field">
        <span>Cliente</span>
        <input v-model="form.customerName" :disabled="isReadOnly" type="text" required />
      </label>

      <label class="field">
        <span>Empresa</span>
        <input v-model="form.companyName" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field">
        <span>Correo</span>
        <input v-model="form.email" :disabled="isReadOnly" type="email" />
      </label>

      <label class="field">
        <span>Teléfono</span>
        <input v-model="form.phone" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field field-span-2">
        <span>Ruta</span>
        <input v-model="form.route" :disabled="isReadOnly" type="text" placeholder="Toluca - Miami" />
      </label>

      <label class="field">
        <span>Origen</span>
        <input v-model="form.origin" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field">
        <span>Destino</span>
        <input v-model="form.destination" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field">
        <span>Pasajeros</span>
        <input v-model="form.passengers" :disabled="isReadOnly" type="number" min="1" />
      </label>

      <label class="field">
        <span>Aeronave</span>
        <input v-model="form.aircraft" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field">
        <span>Proveedor</span>
        <input v-model="form.provider" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field">
        <span>Estatus</span>
        <select v-model="form.status" :disabled="isReadOnly">
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Precio proveedor</span>
        <input v-model="form.providerPrice" :disabled="isReadOnly" type="number" min="0" step="0.01" />
      </label>

      <label class="field">
        <span>FBO</span>
        <input v-model="form.fbo" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field">
        <span>Precio venta</span>
        <input v-model="form.salePrice" :disabled="isReadOnly" type="number" min="0" step="0.01" />
      </label>

      <label class="field">
        <span>Moneda</span>
        <select v-model="form.currency" :disabled="isReadOnly">
          <option v-for="currency in currencyOptions" :key="currency" :value="currency">
            {{ currency }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Próximo seguimiento</span>
        <input v-model="form.nextFollowUp" :disabled="isReadOnly" type="date" />
      </label>

      <label class="field">
        <span>Ejecutivo</span>
        <input v-model="form.executive" :disabled="isReadOnly" type="text" />
      </label>

      <label class="field">
        <span>Tipo de solicitud</span>
        <select v-model="form.requestType" :disabled="isReadOnly">
          <option v-for="type in requestTypeOptions" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Ingreso potencial</span>
        <input v-model="form.potentialRevenue" :disabled="isReadOnly" type="number" min="0" step="0.01" />
      </label>

      <label class="field">
        <span>Ingreso confirmado</span>
        <input v-model="form.confirmedRevenue" :disabled="isReadOnly" type="number" min="0" step="0.01" />
      </label>

      <label class="field">
        <span>Utilidad esperada</span>
        <input v-model="form.expectedProfit" :disabled="isReadOnly" type="number" min="0" step="0.01" />
      </label>
    </div>

    <div v-if="!isReadOnly" class="form-actions">
      <BaseButton type="submit" :disabled="saving">
        {{ saving ? "Guardando..." : mode === "create" ? "Guardar registro" : "Actualizar registro" }}
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.commercial-form {
  display: grid;
  gap: 18px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: var(--text-strong);
  font-size: 0.82rem;
  font-weight: 800;
}

.field input,
.field select {
  padding: 12px 14px;
}

.field-span-2 {
  grid-column: span 2;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: span 1;
  }
}
</style>
