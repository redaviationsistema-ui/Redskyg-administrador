<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { supabaseInventory } from "../../../supabase";
import { useFeedback } from "../../../composables/useFeedback";

const TABLE_NAME = "ventas";
const PRODUCT_OPTIONS = [
  "COTIZACION DE VUELO",
  "CLIENTE",
  "COTIZACION DE AVION",
  "COTIZACION DE COTIZACION",
];

const feedback = useFeedback();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const rows = ref([]);
const responsables = ref([]);
const isModalOpen = ref(false);
const editingId = ref(null);
const search = ref("");
const expandedComments = ref({});

const defaultForm = () => ({
  responsable_id: "",
  nombre_cliente: "",
  producto: "",
  fecha_cotizacion: "",
  proximo_seguimiento: "",
  etapa: "",
  estatus: "Activo",
  fecha_cierre: "",
  comentarios: "",
  telefono: "",
  correo: "",
});

const form = reactive(defaultForm());

const filteredRows = computed(() => {
  const term = search.value.trim().toLowerCase();

  if (!term) return rows.value;

  return rows.value.filter((row) =>
    [
      getResponsableNombre(row.responsable_id),
      row.nombre_cliente,
      row.producto,
      row.etapa,
      row.estatus,
      row.comentarios,
      row.telefono,
      row.correo,
    ].some((value) => String(value || "").toLowerCase().includes(term)),
  );
});

const responsablesMap = computed(
  () => new Map(responsables.value.map((item) => [String(item.id), item.nombre])),
);

const summaryCards = computed(() => ({
  total: rows.value.length,
  activos: rows.value.filter((row) => normalizeStatus(row.estatus) === "activo")
    .length,
  cerrados: rows.value.filter(
    (row) => normalizeStatus(row.estatus) === "cerrado",
  ).length,
  perdidos: rows.value.filter((row) => normalizeStatus(row.estatus) === "perdido")
    .length,
}));

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function getStatusClass(value) {
  const status = normalizeStatus(value);

  if (status === "cerrado") return "status-closed";
  if (status === "perdido") return "status-lost";
  return "status-active";
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(`${value}T00:00:00`).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getResponsableNombre(responsableId) {
  if (!responsableId) return "-";

  return responsablesMap.value.get(String(responsableId)) || responsableId;
}

function isCommentExpanded(rowId) {
  return Boolean(expandedComments.value[rowId]);
}

function toggleComment(rowId) {
  expandedComments.value = {
    ...expandedComments.value,
    [rowId]: !expandedComments.value[rowId],
  };
}

function shouldShowCommentToggle(text) {
  return String(text || "").trim().length > 140;
}

function openCreateModal() {
  Object.assign(form, defaultForm());
  editingId.value = null;
  isModalOpen.value = true;
}

function openEditModal(row) {
  Object.assign(form, {
    responsable_id: row.responsable_id ?? "",
    nombre_cliente: row.nombre_cliente ?? "",
    producto: row.producto ?? "",
    fecha_cotizacion: row.fecha_cotizacion ?? "",
    proximo_seguimiento: row.proximo_seguimiento ?? "",
    etapa: row.etapa ?? "",
    estatus: row.estatus ?? "Activo",
    fecha_cierre: row.fecha_cierre ?? "",
    comentarios: row.comentarios ?? "",
    telefono: row.telefono ?? "",
    correo: row.correo ?? "",
  });
  editingId.value = row.id;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
}

function goBack() {
  router.back();
}

async function loadRows() {
  loading.value = true;

  try {
    const { data, error } = await supabaseInventory
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    rows.value = data || [];
  } catch (err) {
    console.error(err);
    await feedback.error(
      "No se pudo cargar el seguimiento",
      err,
      `Verifica que exista la tabla '${TABLE_NAME}' en Supabase.`,
    );
  } finally {
    loading.value = false;
  }
}

async function loadResponsables() {
  try {
    const { data, error } = await supabaseInventory
      .from("responsables")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (error) throw error;

    responsables.value = data || [];
  } catch (err) {
    console.error(err);
    responsables.value = [];
    await feedback.error(
      "No se pudo cargar la lista de responsables",
      err,
      "Se mostrara el id mientras no se pueda resolver el nombre del responsable.",
    );
  }
}

async function saveRow() {
  if (!form.nombre_cliente || !form.estatus) {
    feedback.notify("Completa los campos obligatorios", "warning");
    return;
  }

  saving.value = true;

  const payload = {
    responsable_id: form.responsable_id || null,
    nombre_cliente: form.nombre_cliente || null,
    producto: form.producto || null,
    fecha_cotizacion: form.fecha_cotizacion || null,
    proximo_seguimiento: form.proximo_seguimiento || null,
    etapa: form.etapa || null,
    estatus: form.estatus || "Activo",
    fecha_cierre: form.fecha_cierre || null,
    comentarios: form.comentarios || null,
    telefono: form.telefono || null,
    correo: form.correo || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const query = editingId.value
      ? supabaseInventory.from(TABLE_NAME).update(payload).eq("id", editingId.value)
      : supabaseInventory.from(TABLE_NAME).insert(payload);

    const { error } = await query;

    if (error) throw error;

    await feedback.success(
      editingId.value ? "Seguimiento actualizado" : "Seguimiento creado",
      "La informacion se guardo correctamente.",
    );

    closeModal();
    await loadRows();
  } catch (err) {
    console.error(err);
    await feedback.error(
      "No se pudo guardar el seguimiento",
      err,
      `Revisa la estructura de la tabla '${TABLE_NAME}'.`,
    );
  } finally {
    saving.value = false;
  }
}

async function deleteRow(row) {
  const result = await feedback.confirm({
    title: "Eliminar seguimiento",
    text: `Se eliminara el registro de ${row.nombre_cliente || row.id}.`,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    icon: "warning",
    confirmButtonColor: "#dc2626",
  });

  if (!result.isConfirmed) return;

  try {
    const { error } = await supabaseInventory
      .from(TABLE_NAME)
      .delete()
      .eq("id", row.id);

    if (error) throw error;

    feedback.notify("Seguimiento eliminado");
    await loadRows();
  } catch (err) {
    console.error(err);
    await feedback.error(
      "No se pudo eliminar el seguimiento",
      err,
      "El registro no pudo eliminarse.",
    );
  }
}

onMounted(async () => {
  await loadResponsables();
  await loadRows();
});
</script>

<template>
  <div class="page">
    <div class="page-top">
      <div>
        <p class="eyebrow">Seguimiento Comercial</p>
        <h1>Seguimiento de ventas</h1>
        <p class="page-subtitle">
          Vista independiente para administrar el CRUD completo conforme al
          reporte de ventas del Excel.
        </p>
      </div>

      <div class="toolbar">
        <button class="secondary-btn" @click="goBack">Regresar</button>
        <button class="refresh-btn" @click="loadRows">Actualizar</button>
        <button class="create-btn" @click="openCreateModal">Nuevo registro</button>
      </div>
    </div>

    <div class="stats-grid">
      <article class="stat-card">
        <span class="stat-label">Total</span>
        <strong class="stat-value">{{ summaryCards.total }}</strong>
      </article>
      <article class="stat-card status-active-soft">
        <span class="stat-label">Activo</span>
        <strong class="stat-value">{{ summaryCards.activos }}</strong>
      </article>
      <article class="stat-card status-closed-soft">
        <span class="stat-label">Cerrado</span>
        <strong class="stat-value">{{ summaryCards.cerrados }}</strong>
      </article>
      <article class="stat-card status-lost-soft">
        <span class="stat-label">Perdido</span>
        <strong class="stat-value">{{ summaryCards.perdidos }}</strong>
      </article>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h2>Reporte de ventas</h2>
          <p>{{ filteredRows.length }} registro(s) disponibles.</p>
        </div>

        <input
          v-model="search"
          class="search-input"
          type="search"
          placeholder="Buscar cliente, producto o estatus"
        />
      </div>

      <div v-if="loading" class="loading-card">
        <div class="loading-spinner"></div>
        <p>Cargando seguimiento...</p>
      </div>

      <div v-else-if="filteredRows.length" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>No registro</th>
              <th>Responsable</th>
              <th>Cliente</th>
              <th>Producto</th>
              <th>Fecha Cotizacion</th>
              <th>Proximo Seguimiento</th>
              <th>Estatus</th>
              <th>Comentarios</th>
              <th>Telefono</th>
              <th>Correo</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="row in filteredRows" :key="row.id">
                <td data-label="No registro">{{ row.id || "-" }}</td>
              <td class="responsable-cell" data-label="Responsable">{{ getResponsableNombre(row.responsable_id) }}</td>
              <td class="client-cell" data-label="Cliente">{{ row.nombre_cliente || "-" }}</td>
              <td data-label="Producto">{{ row.producto || "-" }}</td>
              <td data-label="Fecha Cotizacion">{{ formatDate(row.fecha_cotizacion) }}</td>
              <td data-label="Proximo Seguimiento">{{ row.proximo_seguimiento || "-" }}</td>
              <td data-label="Estatus">
                <span class="status-badge" :class="getStatusClass(row.estatus)">
                  {{ row.estatus || "Activo" }}
                </span>
              </td>
              <td class="comments-cell" data-label="Comentarios">
                <div
                  :class="[
                    'comments-content',
                    { expanded: isCommentExpanded(row.id) },
                  ]"
                >
                  {{ row.comentarios || "-" }}
                </div>
                <button
                  v-if="shouldShowCommentToggle(row.comentarios)"
                  type="button"
                  class="comment-toggle"
                  @click="toggleComment(row.id)"
                >
                  {{ isCommentExpanded(row.id) ? "Ver menos" : "Ver mas" }}
                </button>
              </td>
              <td data-label="Telefono">{{ row.telefono || "-" }}</td>
              <td data-label="Correo">{{ row.correo || "-" }}</td>
              <td data-label="Acciones">
                <div class="actions">
                  <button class="btn btn-secondary" @click="openEditModal(row)">
                    Editar
                  </button>
                  <button class="btn btn-danger" @click="deleteRow(row)">
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <h3>Sin registros</h3>
        <p>
          Cuando la tabla independiente este lista, aqui podras dar de alta,
          editar y eliminar seguimientos de ventas.
        </p>
      </div>
    </div>

    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <p class="modal-kicker">CRUD de seguimiento</p>
            <h2>{{ editingId ? "Editar registro" : "Nuevo registro" }}</h2>
          </div>

          <button class="icon-btn" @click="closeModal">X</button>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>Responsable</span>
            <select v-model="form.responsable_id">
              <option value="">Selecciona un responsable</option>
              <option
                v-for="responsable in responsables"
                :key="responsable.id"
                :value="responsable.id"
              >
                {{ responsable.nombre }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>Nombre del Cliente *</span>
            <input v-model="form.nombre_cliente" type="text" />
          </label>
          <label class="field">
            <span>Producto</span>
            <input v-model="form.producto" type="text" list="product-options" />
            <datalist id="product-options">
              <option
                v-for="option in PRODUCT_OPTIONS"
                :key="option"
                :value="option"
              />
            </datalist>
          </label>
          <label class="field">
            <span>Fecha de Cotizacion</span>
            <input v-model="form.fecha_cotizacion" type="date" />
          </label>
          <label class="field">
            <span>Proximo Seguimiento</span>
            <input v-model="form.proximo_seguimiento" type="text" />
          </label>
          <label class="field">
            <span>Estatus *</span>
            <select v-model="form.estatus">
              <option value="Activo">Activo</option>
              <option value="Cerrado">Cerrado</option>
              <option value="Perdido">Perdido</option>
            </select>
          </label>
          <label class="field field-full">
            <span>Comentarios</span>
            <textarea v-model="form.comentarios" rows="4"></textarea>
          </label>
          <label class="field">
            <span>No Telefonico</span>
            <input v-model="form.telefono" type="text" />
          </label>
          <label class="field">
            <span>Correo</span>
            <input v-model="form.correo" type="email" />
          </label>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="closeModal">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveRow">
            {{ saving ? "Guardando..." : "Guardar" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  padding: 10px 0 36px;
  min-height: 100%;
  font-family: "Segoe UI", sans-serif;
  color: var(--text-main);
}

.page-top,
.toolbar,
.panel-head,
.actions,
.modal-head,
.modal-actions {
  display: flex;
  align-items: center;
}

.page-top,
.panel-head,
.modal-head {
  justify-content: space-between;
  gap: 16px;
}

.toolbar,
.actions,
.modal-actions {
  gap: 10px;
}

.eyebrow,
.stat-label,
.modal-kicker {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 800;
}

.eyebrow,
.modal-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  color: #0f5fa6;
}

h1 {
  margin: 0 0 8px;
  color: var(--text-strong);
  font-size: 34px;
  letter-spacing: -0.03em;
}

.page-subtitle {
  max-width: 880px;
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.refresh-btn,
.create-btn,
.secondary-btn,
.btn,
.icon-btn {
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s ease;
}

.refresh-btn,
.create-btn,
.secondary-btn {
  padding: 12px 18px;
}

.refresh-btn {
  background: #e8eef5;
  color: #334155;
}

.secondary-btn {
  background: var(--bg-surface-solid);
  color: var(--text-strong);
  border: 1px solid #dbe3ee;
}

.create-btn,
.btn-primary {
  background: #0f5fa6;
  color: white;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin: 24px 0 20px;
}

.stat-card {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: var(--bg-surface-solid);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
}

.status-active-soft {
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.12), rgba(255, 255, 255, 1));
}

.status-closed-soft {
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.12), rgba(255, 255, 255, 1));
}

.status-lost-soft {
  background: linear-gradient(180deg, rgba(220, 38, 38, 0.12), rgba(255, 255, 255, 1));
}

.stat-label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  color: #64748b;
}

.stat-value {
  font-size: 36px;
  color: var(--text-strong);
}

.panel,
.modal-card {
  background: var(--bg-surface-solid);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.07);
}

.panel {
  border-radius: 22px;
  overflow: hidden;
}

.panel-head {
  padding: 22px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.panel-head h2,
.modal-head h2 {
  margin: 0 0 4px;
  color: #0f172a;
}

.panel-head p {
  margin: 0;
  color: #64748b;
}

.search-input,
.field input,
.field select,
.field textarea {
  width: 100%;
  border: 1px solid #dbe3ee;
  border-radius: 14px;
  background: #fbfdff;
  color: var(--text-main);
  box-sizing: border-box;
}

.search-input {
  max-width: 320px;
  padding: 12px 14px;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 1600px;
  border-collapse: collapse;
  table-layout: fixed;
}

.table th,
.table td {
  padding: 15px 16px;
  border-top: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
}

.table th {
  background: rgba(15, 95, 166, 0.06);
  color: #475569;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.table tr:hover {
  background: rgba(15, 95, 166, 0.04);
}

.responsable-cell {
  min-width: 100px;
}

.client-cell {
  min-width: 180px;
  width: 180px;
  line-height: 1.5;
  word-break: break-word;
}

.comments-cell {
  min-width: 620px;
  width: 620px;
  max-width: 620px;
  line-height: 1.5;
}

.comments-content {
  display: -webkit-box;
  -webkit-line-clamp: 12;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  color: #0f172a;
}

.comments-content.expanded {
  display: block;
}

.comment-toggle {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: #0f5fa6;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.mono-cell {
  min-width: 210px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  word-break: break-all;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.status-active {
  background: #fef3c7;
  color: #92400e;
}

.status-closed {
  background: #dcfce7;
  color: #166534;
}

.status-lost {
  background: #fee2e2;
  color: #991b1b;
}

.loading-card,
.empty-state {
  padding: 48px 24px;
  text-align: center;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 12px;
  border-radius: 50%;
  border: 3px solid #dbeafe;
  border-top-color: #0f5fa6;
  animation: spin 1s linear infinite;
}

.btn {
  padding: 10px 14px;
  font-size: 12px;
}

.btn-secondary {
  background: #e8eef5;
  color: #334155;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.icon-btn {
  width: 38px;
  height: 38px;
  background: #e8eef5;
  color: #334155;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, 0.42);
  z-index: 50;
}

.modal-card {
  width: min(980px, 100%);
  max-height: calc(100vh - 36px);
  overflow-y: auto;
  border-radius: 24px;
  padding: 24px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.field input,
.field select,
.field textarea {
  padding: 12px 14px;
}

.field-full {
  grid-column: 1 / -1;
}

.modal-actions {
  justify-content: flex-end;
  margin-top: 22px;
}

.btn:hover,
.refresh-btn:hover,
.create-btn:hover,
.icon-btn:hover {
  transform: translateY(-1px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .page {
    padding: 4px 0 24px;
  }

  h1 {
    font-size: 28px;
  }

  .page-top {
    gap: 14px;
  }

  .toolbar,
  .modal-actions {
    width: 100%;
  }

  .secondary-btn,
  .refresh-btn,
  .create-btn {
    width: 100%;
    min-height: 46px;
  }

  .stats-grid {
    grid-auto-flow: column;
    grid-auto-columns: minmax(140px, 1fr);
    grid-template-columns: none;
    gap: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    margin: 18px 0 16px;
    padding-bottom: 6px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-label {
    margin-bottom: 8px;
    font-size: 10px;
  }

  .stat-value {
    font-size: 28px;
  }

  .panel-head {
    padding: 16px 18px;
  }

  .panel-head h2 {
    font-size: 16px;
  }

  .panel-head p {
    font-size: 12px;
  }

  .search-input {
    max-width: none;
    min-height: 46px;
    font-size: 16px;
  }

  .table-wrap {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 6px;
  }

  .table {
    min-width: 1440px;
    width: 1440px;
    border-collapse: collapse;
    background: var(--bg-surface-solid);
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.06);
    table-layout: fixed;
  }

  .comments-cell {
    min-width: 700px;
    width: 700px;
    max-width: 700px;
  }

  .table thead {
    display: table-header-group;
  }

  .table td {
    padding: 10px 12px;
    border-top: 1px solid rgba(226, 232, 240, 0.9);
    text-align: left;
    vertical-align: top;
  }

  .table td::before {
    content: none;
  }

  .page-top,
  .panel-head,
  .toolbar,
  .modal-head,
  .modal-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .stats-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .actions {
    width: max-content;
    justify-content: flex-start;
    flex-wrap: nowrap;
  }

  .btn {
    min-height: 40px;
    font-size: 12px;
    white-space: nowrap;
  }

  .modal-card {
    width: 100%;
    max-height: calc(100dvh - 20px);
    padding: 18px;
    border-radius: 20px;
  }

  .field input,
  .field select,
  .field textarea {
    min-height: 46px;
    font-size: 16px;
  }

  .field textarea {
    min-height: 120px;
  }
}

@media (max-width: 520px) {
  h1 {
    font-size: 24px;
  }

  .table {
    min-width: 1320px;
    width: 1320px;
  }

  .client-cell,
  .comments-cell,
  .responsable-cell {
    min-width: 0;
    max-width: none;
  }
}
</style>
