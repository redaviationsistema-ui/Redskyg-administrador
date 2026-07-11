<script setup>
import { ref } from "vue";
import BaseButton from "@/components/ui/BaseButton.vue";

const props = defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: Object,
    required: true,
  },
  importing: Boolean,
  disabled: Boolean,
});

const emit = defineEmits(["prepare-csv", "prepare-spreadsheet", "prepare-text", "prepare-single", "confirm-import", "clear"]);

const manualList = ref("");
const single = ref({
  email: "",
  name: "",
  company: "",
});

function onCsvSelected(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const extension = String(file.name.split(".").pop() || "").toLowerCase();
  if (extension === "xlsx" || extension === "xls") {
    emit("prepare-spreadsheet", file);
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    emit("prepare-csv", typeof reader.result === "string" ? reader.result : "");
    event.target.value = "";
  };
  reader.readAsText(file);
}

function submitManualList() {
  emit("prepare-text", manualList.value);
}

function submitSingleRecipient() {
  emit("prepare-single", { ...single.value });
  single.value = {
    email: "",
    name: "",
    company: "",
  };
}
</script>

<template>
  <section class="importer-card">
    <header class="section-head">
      <div>
        <h3>Destinatarios</h3>
        <p>Importa CSV o Excel, pega listas manuales o agrega contactos individuales.</p>
      </div>
      <input type="file" accept=".csv,text/csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onCsvSelected" />
    </header>

    <div class="importer-grid">
      <article class="panel-block">
        <h4>Pegar lista manual</h4>
        <textarea
          v-model="manualList"
          rows="5"
          placeholder="correo1@empresa.com&#10;correo2@empresa.com"
        ></textarea>
        <BaseButton variant="secondary" :disabled="disabled" @click="submitManualList">
          Analizar lista
        </BaseButton>
      </article>

      <article class="panel-block">
        <h4>Agregar contacto individual</h4>
        <input v-model="single.email" type="email" placeholder="Correo" />
        <input v-model="single.name" type="text" placeholder="Nombre" />
        <input v-model="single.company" type="text" placeholder="Empresa" />
        <BaseButton variant="secondary" :disabled="disabled" @click="submitSingleRecipient">
          Agregar a revisión
        </BaseButton>
      </article>
    </div>

    <div class="summary-grid">
      <article><span>Total encontrados</span><strong>{{ summary.total }}</strong></article>
      <article><span>Válidos</span><strong>{{ summary.valid }}</strong></article>
      <article><span>Duplicados</span><strong>{{ summary.duplicates }}</strong></article>
      <article><span>Inválidos</span><strong>{{ summary.invalid }}</strong></article>
      <article><span>Automáticos</span><strong>{{ summary.automated }}</strong></article>
      <article><span>Cancelados</span><strong>{{ summary.unsubscribed }}</strong></article>
      <article><span>Listos</span><strong>{{ summary.ready }}</strong></article>
    </div>

    <div v-if="rows.length" class="review-table-wrap">
      <table class="review-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Nombre</th>
            <th>Dominio</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="`${row.email}-${row.name}`">
            <td>{{ row.email || "-" }}</td>
            <td>{{ row.name || "-" }}</td>
            <td>{{ row.domain || "-" }}</td>
            <td>
              <span v-if="!row.isValid" class="status-text status-error">Inválido</span>
              <span v-else-if="row.isDuplicate" class="status-text status-muted">Duplicado</span>
              <span v-else-if="row.isAutomated" class="status-text status-warning">Automático</span>
              <span v-else-if="row.isUnsubscribed" class="status-text status-error">Cancelado</span>
              <span v-else class="status-text status-success">Listo</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="actions">
      <BaseButton variant="secondary" :disabled="!rows.length || importing" @click="emit('clear')">
        Limpiar revisión
      </BaseButton>
      <BaseButton :disabled="!summary.ready || importing || disabled" @click="emit('confirm-import')">
        {{ importing ? "Importando..." : "Confirmar importación" }}
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.importer-card {
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 24px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface-solid);
  box-shadow: var(--shadow-sm);
}

.section-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.section-head h3,
.panel-block h4 {
  margin: 0 0 6px;
  color: var(--text-strong);
}

.section-head p {
  margin: 0;
  color: var(--text-muted);
}

.importer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel-block {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  background: var(--bg-soft);
}

.panel-block input,
.panel-block textarea {
  padding: 12px 14px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}

.summary-grid article {
  padding: 12px;
  border-radius: 16px;
  background: var(--bg-soft);
}

.summary-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.summary-grid strong {
  color: var(--text-strong);
  font-size: 1.1rem;
}

.review-table-wrap {
  overflow-x: auto;
}

.review-table {
  width: 100%;
  border-collapse: collapse;
}

.review-table th,
.review-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.status-text {
  font-weight: 700;
}

.status-success {
  color: var(--success);
}

.status-error {
  color: var(--danger);
}

.status-warning {
  color: var(--warning);
}

.status-muted {
  color: var(--text-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .section-head,
  .actions {
    flex-direction: column;
    align-items: stretch;
  }

  .importer-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
