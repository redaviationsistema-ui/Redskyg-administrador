<script setup>
// import { ref, onMounted } from "vue";
import { ref, onMounted, watch } from "vue";
import { supabase } from "@/supabase";
import { useRouter } from "vue-router";

const router = useRouter();

const aircrafts = ref([]);


const form = ref({
  aeronave_id: "",
  start_date: "",
  end_date: "",
  reason_type: "",
  reason: "",
});

const loading = ref(false);
console.log("Seleccionado:", form.value.reason_type);

// 🔹 Traer aeronaves disponibles
onMounted(async () => {
  const { data, error } = await supabase
    .from("aircraft_fleet")
    .select("id, name");
  // .eq("disponible", true);

  if (error) {
    console.error(error);
    return;
  }

  aircrafts.value = data;
});

const saveBlockedDate = async () => {
  if (
    !form.value.aeronave_id ||
    !form.value.start_date ||
    !form.value.end_date
  ) {
    alert("Completa los campos obligatorios");
    return;
  }

  if (form.value.end_date < form.value.start_date) {
    alert("La fecha final no puede ser menor a la inicial");
    return;
  }

  loading.value = true;

  try {
    const aircraftId = form.value.aeronave_id;

    const startISO = new Date(form.value.start_date + "T00:00:00").toISOString();
    const endISO = new Date(form.value.end_date + "T23:59:59").toISOString();

    /* =====================================================
       1️⃣ VALIDAR OVERLAPPING REAL
    ===================================================== */

    // const { data: existing, error: checkError } = await supabase
    //   .from("reservations")
    //   .select("id")
    //   .eq("aircraft_id", aircraftId)
    //   .in("status", ["pending", "confirmed", "blocked"])
    //   .lte("start_datetime", endISO)
    //   .gte("end_datetime", startISO);
    const { data: existing, error: checkError } = await supabase
  .from("reservations")
  .select("id")
  .eq("aircraft_id", aircraftId)
  .lte("start_datetime", endISO)
  .gte("end_datetime", startISO);

    if (checkError) throw checkError;

    if (existing.length > 0) {
      alert("Ya existe una reserva o bloqueo en ese rango.");
      loading.value = false;
      return;
    }

    /* =====================================================
       2️⃣ CREAR BLOQUEO COMO RESERVATION
    ===================================================== */

    const { error: insertError } = await supabase
      .from("reservations")
      .insert({
        aircraft_id: aircraftId,
        start_datetime: startISO,
        end_datetime: endISO,
        // status: "blocked",
        status: form.value.reason_type.trim(),
        quote_id: null,
      });

    if (insertError) throw insertError;

    alert("Rango bloqueado correctamente");

    router.push("/blocked-dates");

  } catch (err) {
    console.error(err);
    alert("Error al guardar bloqueo");
  } finally {
    loading.value = false;
  }
};
watch(
  [() => form.value.aeronave_id, () => form.value.reason_type],
  ([newAircraftId, newReasonType]) => {
    if (!newAircraftId || !newReasonType) {
      form.value.reason = "";
      return;
    }

    const selected = aircrafts.value.find((a) => a.id === newAircraftId);

    if (selected) {
      form.value.reason = `${newReasonType} - ${selected.name}`;
    }
  },
);
</script>

<template>
  <section class="form-section">
    <h2>Bloquear Rango de Fechas</h2>

    <form @submit.prevent="saveBlockedDate" class="form-card">
      <div class="form-group">
        <label>Aeronave</label>
        <select v-model="form.aeronave_id" required>
          <option value="" disabled>Selecciona una aeronave</option>

          <option v-for="a in aircrafts" :key="a.id" :value="a.id">
            {{ a.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>Fecha Inicio</label>
        <input v-model="form.start_date" type="date" required />
      </div>

      <div class="form-group">
        <label>Fecha Fin</label>
        <input v-model="form.end_date" type="date" required />
      </div>
      <div class="form-group">
        <label>Tipo de Motivo</label>
        <select v-model="form.reason_type" required>
          <option value="" disabled>Selecciona motivo</option>
          <option value="Bloqueo">Bloqueo</option>
          <option value="Mantenimiento">Mantenimiento</option>
          <option value="Inspección">Inspección</option>
          <option value="Operación Especial">Operación Especial</option>
        </select>
      </div>
      <div class="form-group">
        <label>Motivo</label>
        <!-- <input v-model="form.reason" type="text" /> -->
        <input v-model="form.reason" type="text" readonly />
      </div>

      <button type="submit" :disabled="loading">
        {{ loading ? "Guardando..." : "Guardar" }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.form-section {
  padding: 60px 30px;
  background: linear-gradient(135deg, #f4f6f9 0%, #eef1f5 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
}

.form-card {
  background: #ffffff;
  padding: 40px;
  border-radius: 16px;
  width: 100%;
  max-width: 650px;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5e7eb;
  transition: 0.3s ease;
}

.form-card:hover {
  box-shadow: 0 15px 45px rgba(0, 0, 0, 0.08);
}

h2 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 30px;
  color: #111827;
  letter-spacing: -0.5px;
}

.form-group {
  margin-bottom: 22px;
  display: flex;
  flex-direction: column;
}

label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input,
select {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 14px;
  background: #f9fafb;
  transition: all 0.2s ease;
}

input:focus,
select:focus {
  outline: none;
  border-color: #1f2937;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(31, 41, 55, 0.1);
}

input[readonly] {
  background: #f3f4f6;
  color: #6b7280;
  font-weight: 500;
}

button {
  margin-top: 15px;
  background: linear-gradient(135deg, #111827, #1f2937);
  color: #ffffff;
  padding: 12px;
  border-radius: 10px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  letter-spacing: 0.5px;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(17, 24, 39, 0.25);
}

button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
</style>
