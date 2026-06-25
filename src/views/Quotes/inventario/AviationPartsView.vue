<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { supabaseInventory } from "@/supabase";
import { useFeedback } from "@/composables/useFeedback";

const router = useRouter();
const feedback = useFeedback();

const loading = ref(false);
const saving = ref(false);
const search = ref("");
const parts = ref([]);
const editorOpen = ref(false);
const editorMode = ref("create");
const editingIdentity = ref(null);

const filters = ref({
  partNumber: "",
  description: "",
  aircraft: "",
  condition: "",
  qty: "",
  um: "",
  manufacturer: "",
  code: "",
});

const partForm = ref(createEmptyPartForm());

function createEmptyPartForm() {
  return {
    partnumber: "",
    description: "",
    alternatepartnumber: "",
    conditioncode: "",
    quantity: "",
    uom: "EA",
    manufacturer: "",
    unitprice: "",
    core_value: "N/A",
    or: "",
    ex: "",
    aircrafttype: "",
    enginetype: "",
    cert_type: "CofC",
    codigofolio: "",
  };
}

function buildRowKey(part) {
  if (part?.id !== undefined && part?.id !== null) {
    return `id-${part.id}`;
  }

  return [
    part?.partnumber || "",
    part?.codigofolio || "",
    part?.conditioncode || "",
    part?.aircrafttype || "",
    part?.description || "",
  ].join("::");
}

function buildIdentity(part) {
  if (part?.id !== undefined && part?.id !== null) {
    return { id: part.id };
  }

  return {
    partnumber: part?.partnumber || "",
    codigofolio: part?.codigofolio || "",
    conditioncode: part?.conditioncode || "",
    aircrafttype: part?.aircrafttype || "",
    description: part?.description || "",
  };
}

function mapPartRecord(part) {
  const normalized = {
    ...part,
    id: part?.id ?? null,
    created_at: part?.created_at ?? "",
    updated_at: part?.updated_at ?? "",
    partnumber: part?.PartNumber ?? part?.partnumber ?? part?.PARTNUMBER ?? "",
    description: part?.Description ?? part?.description ?? part?.DESCRIPTION ?? "",
    alternatepartnumber:
      part?.AlternatePartNumber ??
      part?.alternatepartnumber ??
      part?.ALTERNATEPARTNUMBER ??
      "",
    conditioncode:
      part?.ConditionCode ?? part?.conditioncode ?? part?.CONDITIONCODE ?? "",
    quantity: part?.Quantity ?? part?.quantity ?? part?.QUANTITY ?? null,
    uom: part?.UoM ?? part?.uom ?? part?.UOM ?? "",
    manufacturer: part?.Manufacturer ?? part?.manufacturer ?? part?.MANUFACTURER ?? "",
    unitprice: part?.PRICE ?? part?.unitprice ?? part?.price ?? null,
    core_value:
      part?.["CORE VALUE"] ?? part?.core_value ?? part?.CORE_VALUE ?? null,
    or: part?.or ?? part?.OR ?? null,
    ex: part?.ex ?? part?.EX ?? null,
    aircrafttype: part?.AircraftType ?? part?.aircrafttype ?? part?.AIRCRAFTTYPE ?? "",
    enginetype: part?.EngineType ?? part?.enginetype ?? part?.ENGINETYPE ?? "",
    cert_type:
      part?.["CERT TYPE"] ?? part?.cert_type ?? part?.CERT_TYPE ?? part?.CERTTYPE ?? "",
    codigofolio: part?.codigofolio ?? part?.CODIGOFOLIO ?? "",
  };

  return {
    ...normalized,
    _rowKey: buildRowKey(normalized),
    _identity: buildIdentity(normalized),
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const trimmed = normalizeText(value);
  return trimmed || null;
}

function normalizeNumber(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function getCoreValueDisplay(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "N/A";
}

function normalizeCoreValueForDb(value) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed || trimmed.toUpperCase() === "N/A") {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildPayload(form) {
  return {
    PartNumber: normalizeText(form.partnumber).toUpperCase(),
    Description: normalizeText(form.description),
    AlternatePartNumber:
      normalizeNullableText(form.alternatepartnumber)?.toUpperCase() || null,
    ConditionCode: normalizeNullableText(form.conditioncode)?.toUpperCase() || null,
    Quantity: normalizeNumber(form.quantity),
    UoM: normalizeNullableText(form.uom)?.toUpperCase() || null,
    Manufacturer: normalizeNullableText(form.manufacturer),
    PRICE: normalizeNumber(form.unitprice),
    "CORE VALUE": normalizeCoreValueForDb(form.core_value),
    OR: normalizeNumber(form.or),
    EX: normalizeNumber(form.ex),
    AircraftType: normalizeNullableText(form.aircrafttype)?.toUpperCase() || null,
    EngineType: normalizeNullableText(form.enginetype)?.toUpperCase() || null,
    "CERT TYPE": normalizeNullableText(form.cert_type) || "CofC",
    codigofolio: normalizeNullableText(form.codigofolio)?.toUpperCase() || null,
  };
}

function applyIdentityFilter(query, identity) {
  if (!identity) return query;

  if (identity.id !== undefined && identity.id !== null) {
    return query.eq("id", identity.id);
  }

  return query
    .eq("PartNumber", identity.partnumber || "")
    .eq("codigofolio", identity.codigofolio || "")
    .eq("ConditionCode", identity.conditioncode || "")
    .eq("AircraftType", identity.aircrafttype || "")
    .eq("Description", identity.description || "");
}

const aircraftOptions = computed(() =>
  [...new Set(parts.value.map((part) => part.aircrafttype).filter(Boolean))].sort(
    (a, b) => String(a).localeCompare(String(b)),
  ),
);

const conditionOptions = computed(() =>
  [
    ...new Set(parts.value.map((part) => part.conditioncode).filter(Boolean)),
  ].sort((a, b) => String(a).localeCompare(String(b))),
);

const umOptions = computed(() =>
  [...new Set(parts.value.map((part) => part.uom).filter(Boolean))].sort(
    (a, b) => String(a).localeCompare(String(b)),
  ),
);

const filteredParts = computed(() => {
  const term = search.value.trim().toLowerCase();

  return parts.value.filter((part) => {
    const matchesSearch =
      !term ||
      [
        part.partnumber,
        part.description,
        part.alternatepartnumber,
        part.aircrafttype,
        part.conditioncode,
        part.codigofolio,
        part.manufacturer,
        part.core_value,
        part.cert_type,
        part.id,
        part.created_at,
        part.updated_at,
      ].some((value) => String(value || "").toLowerCase().includes(term));

    const matchesPartNumber =
      !filters.value.partNumber ||
      String(part.partnumber || "")
        .toLowerCase()
        .includes(filters.value.partNumber.toLowerCase());

    const matchesDescription =
      !filters.value.description ||
      String(part.description || "")
        .toLowerCase()
        .includes(filters.value.description.toLowerCase());

    const matchesAircraft =
      !filters.value.aircraft || part.aircrafttype === filters.value.aircraft;

    const matchesCondition =
      !filters.value.condition ||
      part.conditioncode === filters.value.condition;

    const matchesQty =
      !filters.value.qty ||
      String(part.quantity ?? "")
        .toLowerCase()
        .includes(filters.value.qty.toLowerCase());

    const matchesUm = !filters.value.um || part.uom === filters.value.um;

    const matchesManufacturer =
      !filters.value.manufacturer ||
      String(part.manufacturer || "")
        .toLowerCase()
        .includes(filters.value.manufacturer.toLowerCase());

    const matchesCode =
      !filters.value.code ||
      String(part.codigofolio || "")
        .toLowerCase()
        .includes(filters.value.code.toLowerCase());

    return (
      matchesSearch &&
      matchesPartNumber &&
      matchesDescription &&
      matchesAircraft &&
      matchesCondition &&
      matchesQty &&
      matchesUm &&
      matchesManufacturer &&
      matchesCode
    );
  });
});

async function fetchParts() {
  loading.value = true;

  try {
    const { data, error } = await supabaseInventory
      .from("aviation_parts")
      .select("*")
      .range(0, 4999);

    if (error) throw error;

    parts.value = (data || [])
      .map(mapPartRecord)
      .sort((a, b) =>
        String(a.partnumber || "").localeCompare(String(b.partnumber || "")),
      );
  } catch (error) {
    console.error("Unable to load aviation parts", error);
    parts.value = [];
    await feedback.error(
      "Unable to load aviation parts",
      error,
      "The parts catalog could not be loaded.",
    );
  } finally {
    loading.value = false;
  }
}

function openCreateEditor() {
  editorMode.value = "create";
  editingIdentity.value = null;
  partForm.value = createEmptyPartForm();
  editorOpen.value = true;
}

function openEditEditor(part) {
  editorMode.value = "edit";
  editingIdentity.value = { ...part._identity };
  partForm.value = {
    partnumber: part.partnumber || "",
    description: part.description || "",
    alternatepartnumber: part.alternatepartnumber || "",
    conditioncode: part.conditioncode || "",
    quantity: part.quantity ?? "",
    uom: part.uom || "EA",
    manufacturer: part.manufacturer || "",
    unitprice: part.unitprice ?? "",
    core_value: getCoreValueDisplay(part.core_value),
    or: part.or ?? "",
    ex: part.ex ?? "",
    aircrafttype: part.aircrafttype || "",
    enginetype: part.enginetype || "",
    cert_type: part.cert_type || "CofC",
    codigofolio: part.codigofolio || "",
  };
  editorOpen.value = true;
}

function closeEditor() {
  if (saving.value) return;

  editorOpen.value = false;
  editorMode.value = "create";
  editingIdentity.value = null;
  partForm.value = createEmptyPartForm();
}

async function savePart() {
  const payload = buildPayload(partForm.value);

  if (!payload.PartNumber) {
    feedback.notify("Part Number is required", "warning");
    return;
  }

  saving.value = true;

  try {
    if (editorMode.value === "create") {
      const { error } = await supabaseInventory
        .from("aviation_parts")
        .insert(payload);

      if (error) throw error;

      feedback.notify("Part created successfully", "success");
    } else {
      let query = supabaseInventory.from("aviation_parts").update(payload);
      query = applyIdentityFilter(query, editingIdentity.value);

      const { error } = await query;

      if (error) throw error;

      feedback.notify("Part updated successfully", "success");
    }

    closeEditor();
    await fetchParts();
  } catch (error) {
    console.error("Unable to save aviation part", error);
    await feedback.error(
      editorMode.value === "create"
        ? "Unable to create part"
        : "Unable to update part",
      error,
      "Please review the form information and try again.",
    );
  } finally {
    saving.value = false;
  }
}

async function deletePart(part) {
  const result = await feedback.confirm({
    title: "Delete aviation part?",
    text: `This will remove ${part.partnumber || "this record"} from the catalog.`,
    confirmButtonText: "Delete part",
    cancelButtonText: "Keep part",
    icon: "warning",
    confirmButtonColor: "#dc2626",
  });

  if (!result.isConfirmed) return;

  try {
    let query = supabaseInventory.from("aviation_parts").delete();
    query = applyIdentityFilter(query, part._identity);

    const { error } = await query;

    if (error) throw error;

    feedback.notify("Part deleted successfully", "success");
    await fetchParts();
  } catch (error) {
    console.error("Unable to delete aviation part", error);
    await feedback.error(
      "Unable to delete part",
      error,
      "The selected record could not be removed.",
    );
  }
}

function sendPartToQuote(part) {
  router.push({
    name: "CreateInventoryQuote",
    query: {
      part_number: part.partnumber || "",
    },
  });
}

onMounted(fetchParts);
</script>

<template>
  <section class="page">
    <div class="hero">
      <div>
        <p class="eyebrow">Quotes Workspace</p>
        <h1>Aviation Parts</h1>
        <p class="subtitle">
          Quick catalog view aligned to the current aviation_parts schema.
        </p>
      </div>

      <div class="hero-stats">
        <div class="stat-card">
          <span>Total parts</span>
          <strong>{{ parts.length }}</strong>
        </div>
        <div class="stat-card">
          <span>Visible</span>
          <strong>{{ filteredParts.length }}</strong>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <input
        v-model="search"
        type="text"
        class="search-input"
        placeholder="Search part number, alternate, description, aircraft, manufacturer or code..."
      />

      <div class="toolbar-actions">
        <button type="button" class="secondary-btn" @click="fetchParts">
          Refresh
        </button>
        <button type="button" class="primary-btn" @click="openCreateEditor">
          New Part
        </button>
      </div>
    </div>

    <div v-if="loading" class="state-card">
      Loading aviation parts...
    </div>

    <div v-else class="table-shell">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Part Number</th>
            <th>Description</th>
            <th>Alt Part Number</th>
            <th>Aircraft</th>
            <th>Engine</th>
            <th>CD</th>
            <th>Qty</th>
            <th>UM</th>
            <th>Manufacturer</th>
            <th>Code</th>
            <th>Core Value</th>
            <th>Cert Type</th>
            <th>OR</th>
            <th>EX</th>
            <th>Unit Price</th>
            <th>Created</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
          <tr class="filters-row">
            <th>
              <input
                type="text"
                class="column-filter"
                placeholder="N/A"
                disabled
              />
            </th>
            <th>
              <input
                v-model="filters.partNumber"
                type="text"
                class="column-filter"
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                v-model="filters.description"
                type="text"
                class="column-filter"
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                type="text"
                class="column-filter"
                placeholder="N/A"
                disabled
              />
            </th>
            <th>
              <select v-model="filters.aircraft" class="column-filter">
                <option value="">All aircraft</option>
                <option
                  v-for="option in aircraftOptions"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
            </th>
            <th>
              <input
                type="text"
                class="column-filter"
                placeholder="N/A"
                disabled
              />
            </th>
            <th>
              <select v-model="filters.condition" class="column-filter">
                <option value="">All CD</option>
                <option
                  v-for="option in conditionOptions"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
            </th>
            <th>
              <input
                v-model="filters.qty"
                type="text"
                class="column-filter"
                placeholder="Filter..."
              />
            </th>
            <th>
              <select v-model="filters.um" class="column-filter">
                <option value="">All UM</option>
                <option
                  v-for="option in umOptions"
                  :key="option"
                  :value="option"
                >
                  {{ option }}
                </option>
              </select>
            </th>
            <th>
              <input
                v-model="filters.manufacturer"
                type="text"
                class="column-filter"
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                v-model="filters.code"
                type="text"
                class="column-filter"
                placeholder="Filter..."
              />
            </th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="part in filteredParts" :key="part._rowKey">
            <td>{{ part.id ?? "-" }}</td>
            <td class="cell-strong">{{ part.partnumber || "-" }}</td>
            <td class="cell-description">{{ part.description || "-" }}</td>
            <td>{{ part.alternatepartnumber || "-" }}</td>
            <td>{{ part.aircrafttype || "-" }}</td>
            <td>{{ part.enginetype || "-" }}</td>
            <td>{{ part.conditioncode || "-" }}</td>
            <td>{{ part.quantity ?? "-" }}</td>
            <td>{{ part.uom || "-" }}</td>
            <td>{{ part.manufacturer || "-" }}</td>
            <td>{{ part.codigofolio || "-" }}</td>
            <td>{{ part.core_value ?? "N/A" }}</td>
            <td>{{ part.cert_type || "-" }}</td>
            <td>{{ part.or ?? "-" }}</td>
            <td>{{ part.ex ?? "-" }}</td>
            <td>${{ Number(part.unitprice || 0).toLocaleString() }}</td>
            <td>{{ formatDateTime(part.created_at) }}</td>
            <td>{{ formatDateTime(part.updated_at) }}</td>
            <td>
              <div class="row-actions">
                <button
                  type="button"
                  class="table-btn add-btn"
                  @click="sendPartToQuote(part)"
                >
                  Quote
                </button>
                <button
                  type="button"
                  class="table-btn edit-btn"
                  @click="openEditEditor(part)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="table-btn delete-btn"
                  @click="deletePart(part)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredParts.length" class="empty-state-row">
            <td colspan="19" class="empty-row">
              No aviation parts found with the current filter.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editorOpen" class="modal-overlay" @click.self="closeEditor">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <p class="eyebrow modal-eyebrow">Aviation Parts</p>
            <h2>{{ editorMode === "create" ? "New Part" : "Edit Part" }}</h2>
          </div>

          <button type="button" class="icon-btn" @click="closeEditor">
            X
          </button>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>Part Number</span>
            <input v-model="partForm.partnumber" type="text" />
          </label>

          <label class="field field-wide">
            <span>Description</span>
            <input v-model="partForm.description" type="text" />
          </label>

          <label class="field">
            <span>Alt Part Number</span>
            <input v-model="partForm.alternatepartnumber" type="text" />
          </label>

          <label class="field">
            <span>CD</span>
            <input v-model="partForm.conditioncode" type="text" />
          </label>

          <label class="field">
            <span>Qty</span>
            <input v-model="partForm.quantity" type="number" min="0" step="1" />
          </label>

          <label class="field">
            <span>UM</span>
            <input v-model="partForm.uom" type="text" />
          </label>

          <label class="field">
            <span>Manufacturer</span>
            <input v-model="partForm.manufacturer" type="text" />
          </label>

          <label class="field">
            <span>Core Value</span>
            <input v-model="partForm.core_value" type="text" />
          </label>

          <label class="field">
            <span>Cert Type</span>
            <input v-model="partForm.cert_type" type="text" />
          </label>

          <label class="field">
            <span>Unit Price</span>
            <input v-model="partForm.unitprice" type="number" min="0" step="0.01" />
          </label>

          <label class="field">
            <span>OR</span>
            <input v-model="partForm.or" type="number" min="0" step="0.01" />
          </label>

          <label class="field">
            <span>EX</span>
            <input v-model="partForm.ex" type="number" min="0" step="0.01" />
          </label>

          <label class="field">
            <span>Aircraft</span>
            <input v-model="partForm.aircrafttype" type="text" />
          </label>

          <label class="field">
            <span>Engine</span>
            <input v-model="partForm.enginetype" type="text" />
          </label>

          <label class="field">
            <span>Code</span>
            <input v-model="partForm.codigofolio" type="text" />
          </label>
        </div>

        <div class="modal-actions">
          <button
            type="button"
            class="secondary-btn"
            :disabled="saving"
            @click="closeEditor"
          >
            Cancel
          </button>
          <button
            type="button"
            class="primary-btn"
            :disabled="saving"
            @click="savePart"
          >
            {{ saving ? "Saving..." : editorMode === "create" ? "Create Part" : "Save Changes" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  width: 100%;
  min-height: 100%;
  padding: 10px 0 36px;
  color: var(--text-main);
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 30px;
  border-radius: 26px;
  background:
    radial-gradient(circle at top left, rgba(15, 95, 166, 0.18), transparent 28%),
    linear-gradient(135deg, #f8fbff 0%, #eef6ff 55%, #fff7ed 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0f5fa6;
}

h1,
h2 {
  margin: 0 0 10px;
  color: #0f172a;
  letter-spacing: -0.04em;
}

h1 {
  font-size: 38px;
}

h2 {
  font-size: 28px;
}

.subtitle {
  max-width: 760px;
  margin: 0;
  line-height: 1.6;
  color: #475569;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(120px, 1fr));
  gap: 12px;
  min-width: 260px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(15, 95, 166, 0.08);
}

.stat-card span {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.stat-card strong {
  font-size: 1.8rem;
  line-height: 1;
  color: #0f172a;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}

.search-input,
.column-filter,
.field input {
  width: 100%;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 16px;
  background: #fff;
  color: var(--text-main);
  font-size: 0.94rem;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.04);
}

.column-filter {
  padding: 8px 10px;
  min-width: 120px;
  border-radius: 10px;
  font-size: 0.84rem;
  box-shadow: none;
}

.search-input:focus,
.column-filter:focus,
.field input:focus {
  border-color: #0f5fa6;
  outline: none;
  box-shadow: 0 0 0 4px rgba(15, 95, 166, 0.12);
}

.primary-btn,
.secondary-btn,
.table-btn,
.icon-btn {
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, opacity 0.2s ease;
}

.primary-btn,
.secondary-btn {
  padding: 14px 18px;
  border-radius: 14px;
  font-weight: 700;
}

.primary-btn {
  background: #0f5fa6;
  color: #fff;
}

.primary-btn:hover,
.secondary-btn:hover,
.table-btn:hover,
.icon-btn:hover {
  transform: translateY(-1px);
}

.secondary-btn {
  background: rgba(15, 95, 166, 0.08);
  color: #0f5fa6;
}

.state-card {
  margin-top: 18px;
  padding: 24px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #64748b;
  text-align: center;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.05);
}

.table-shell {
  margin-top: 18px;
  overflow-x: auto;
  border-radius: 24px;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.05);
}

.table {
  width: 100%;
  min-width: 1420px;
  border-collapse: collapse;
}

.table thead th {
  padding: 16px 18px;
  text-align: left;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
  background: rgba(15, 95, 166, 0.06);
}

.filters-row th {
  padding-top: 10px;
  padding-bottom: 14px;
  background: rgba(15, 95, 166, 0.03);
}

.table tbody td {
  padding: 16px 18px;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
  color: #334155;
  font-size: 0.92rem;
  vertical-align: top;
}

.table tbody tr:hover {
  background: rgba(15, 95, 166, 0.03);
}

.table tbody tr.empty-state-row:hover {
  background: transparent;
}

.cell-strong {
  font-weight: 800;
  color: #0f172a;
}

.cell-description {
  min-width: 280px;
}

.empty-row {
  padding: 28px 18px;
  text-align: center;
  color: #64748b;
}

.row-actions {
  display: flex;
  gap: 8px;
}

.table-btn {
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 700;
}

.edit-btn {
  background: rgba(15, 95, 166, 0.1);
  color: #0f5fa6;
}

.add-btn {
  background: rgba(14, 116, 144, 0.12);
  color: #0f766e;
}

.delete-btn {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  padding: 36px 20px 20px;
  background: rgba(15, 23, 42, 0.56);
  backdrop-filter: blur(4px);
}

.modal-card {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 28px;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 20px;
}

.modal-eyebrow {
  margin-bottom: 6px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(15, 95, 166, 0.08);
  color: #0f5fa6;
  font-weight: 700;
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
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.field-wide {
  grid-column: span 2;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.primary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.7;
  cursor: wait;
  transform: none;
}

@media (max-width: 980px) {
  .hero,
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-stats {
    width: 100%;
    min-width: 0;
  }

  .toolbar-actions {
    justify-content: flex-end;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-wide {
    grid-column: span 1;
  }
}

@media (max-width: 640px) {
  .modal-overlay {
    padding-top: 16px;
  }

  .hero,
  .modal-card {
    padding: 22px;
  }

  h1 {
    font-size: 30px;
  }

  h2 {
    font-size: 24px;
  }

  .toolbar-actions,
  .modal-actions,
  .row-actions {
    flex-direction: column;
  }
}
</style>
