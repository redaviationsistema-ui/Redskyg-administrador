<template>
  <div class="page">
    <div class="form-card">
      <h2>Crear / Editar Aeronave</h2>

      <!-- ===================== -->
      <!-- DATOS DE LA AERONAVE -->
      <!-- ===================== -->

      <div class="form-grid">
        <div class="form-group">
          <label>Nombre</label>
          <input v-model="form.name" />
        </div>

        <div class="form-group">
          <label>Año</label>
          <input type="number" v-model="form.year" />
        </div>

        <div class="form-group">
          <label>Tipo de aeronave</label>
          <input v-model="form.aircraft_type" />
        </div>

        <div class="form-group">
          <label>Motores</label>
          <input v-model="form.engines" />
        </div>

        <div class="form-group">
          <label>Capacidad pasajeros</label>
          <input type="number" v-model="form.capacity_passengers" />
        </div>

        <div class="form-group">
          <label>Tripulación</label>
          <input type="number" v-model="form.crew" />
        </div>

        <div class="form-group">
          <label>Base</label>
          <input v-model="form.home_base" />
        </div>

        <div class="form-group">
          <label>Precio por hora (USD)</label>
          <input type="number" v-model="form.rental_price_usd" />
        </div>

        <div class="form-group">
          <label>Velocidad crucero (knots)</label>
          <input type="number" v-model="form.cruise_speed_knots" />
        </div>

        <div class="form-group">
          <label>Gastos nacionales (USD)</label>
          <input type="number" v-model="form.national_expenses_usd" />
        </div>

        <div class="form-group">
          <label>Estado</label>
          <input v-model="form.estado" />
        </div>

        <div class="form-group">
          <label>Ciudad</label>
          <input v-model="form.ciudad" />
        </div>

        <div class="form-group">
          <label>Aeropuerto</label>
          <input v-model="form.aeropuerto" />
        </div>
      </div>

      <div class="form-group">
        <label>Uso ideal</label>
        <input v-model="form.ideal_use" />
      </div>

      <div class="form-group">
        <label>Descripción</label>
        <textarea v-model="form.descripcion" rows="4"></textarea>
      </div>

      <div class="form-group checkbox">
        <input type="checkbox" v-model="form.is_active" />
        <label>Activa</label>
      </div>

      <!-- BOTÓN GUARDAR AERONAVE -->
      <button class="btn-primary" @click="saveAircraft">
        Guardar Aeronave
      </button>

      <hr />

      <!-- ===================== -->
      <!-- SUBIR IMÁGENES -->
      <!-- ===================== -->

      <h3>Galería de Imágenes</h3>

      <div class="form-group">
        <input
          type="file"
          accept="image/*"
          multiple
          @change="handleFileUpload"
        />
        <small>JPG, PNG, WEBP (máx 2MB)</small>
      </div>

      <div v-if="previewImages.length" class="image-preview">
        <div
          v-for="(img, index) in previewImages"
          :key="index"
          class="image-box"
        >
          <img :src="img" />
        </div>
      </div>

      <button class="btn-secondary" @click="saveImages">
        Guardar Imágenes
      </button>

      <!-- GUARDAR TODO -->
      <button class="btn-success" @click="saveAll">
        Guardar Todo
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "@/supabase";
import { useRoute, useRouter } from "vue-router";

/* ===============================
   ROUTER
================================= */
const route = useRoute();
const router = useRouter();

/* ===============================
   STATE
================================= */
const loading = ref(false);

const form = ref({
  id: null,
  year: "",
  name: "",
  aircraft_type: "",
  engines: "",
  capacity_passengers: "",
  crew: "",
  home_base: "",
  rental_price_usd: "",
  ideal_use: "",
  cruise_speed_knots: "",
  national_expenses_usd: "",
  estado: "",
  ciudad: "",
  aeropuerto: "",
  descripcion: "",
  is_active: true
});

const previewImages = ref([]);
const uploadedImages = ref([]);

/* ===============================
   CARGAR AERONAVE (MODO EDITAR)
================================= */
const loadAircraft = async () => {
  const id = route.params.id;

  if (!id) return; // si es nuevo, no hace nada

  loading.value = true;

  try {
    const { data, error } = await supabase
      .from("aircraft_fleet")
      .select(`
        *,
        aeronave_imagenes (
          id,
          imagen_url
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    // Cargar datos en el form
    form.value = { ...data };

    // Cargar imágenes existentes
    if (data.aeronave_imagenes?.length) {
      previewImages.value = data.aeronave_imagenes.map(
        img => img.imagen_url
      );
    }

  } catch (error) {
    console.error("Error cargando aeronave:", error);
    alert("Error al cargar aeronave");
  } finally {
    loading.value = false;
  }
};

/* ===============================
   GUARDAR AERONAVE
================================= */
const saveAircraft = async () => {
  try {
    loading.value = true;

    const { id, ...aircraftData } = form.value;

    let response;

    if (id) {
      // UPDATE
      response = await supabase
        .from("aircraft_fleet")
        .update(aircraftData)
        .eq("id", id)
        .select()
        .single();
    } else {
      // INSERT
      response = await supabase
        .from("aircraft_fleet")
        .insert([aircraftData])
        .select()
        .single();
    }

    if (response.error) throw response.error;

    form.value.id = response.data.id;

    alert("Aeronave guardada correctamente");

  } catch (error) {
    console.error("Error guardando aeronave:", error);
    alert("Error al guardar aeronave");
  } finally {
    loading.value = false;
  }
};

/* ===============================
   SUBIR IMÁGENES
================================= */
const handleFileUpload = async (event) => {
  const files = Array.from(event.target.files);

  if (!form.value.id) {
    alert("Primero guarda la aeronave");
    return;
  }

  for (const file of files) {

    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes");
      continue;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Imagen mayor a 2MB");
      continue;
    }

    const filePath = `${form.value.id}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("aircraft-images")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error("Error subiendo imagen:", error);
      continue;
    }

    const { data } = supabase.storage
      .from("aircraft-images")
      .getPublicUrl(filePath);

    previewImages.value.push(data.publicUrl);

    uploadedImages.value.push({
      aircraft_id: form.value.id,
      imagen_url: data.publicUrl
    });
  }
};

/* ===============================
   GUARDAR IMÁGENES EN BD
================================= */
const saveImages = async () => {

  if (!uploadedImages.value.length) return;

  try {
    const { error } = await supabase
      .from("aeronave_imagenes")
      .insert(uploadedImages.value);

    if (error) throw error;

    uploadedImages.value = [];

    alert("Imágenes guardadas correctamente");

  } catch (error) {
    console.error("Error guardando imágenes:", error);
    alert("Error al guardar imágenes");
  }
};

/* ===============================
   GUARDAR TODO
================================= */
const saveAll = async () => {
  await saveAircraft();
  await saveImages();

  router.push("/aircraft"); // volver al listado
};

/* ===============================
   MOUNT
================================= */
onMounted(() => {
  loadAircraft();
});
</script>

<style scoped>
.page {
  padding: 50px;
  display: flex;
  justify-content: center;
  background: #f4f6fb;
  min-height: 100vh;
}

.form-card {
  background: white;
  padding: 50px;
  border-radius: 20px;
  width: 1100px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.08);
}

h2 {
  font-size: 28px;
  margin-bottom: 40px;
}

/* GRID REAL */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 25px 40px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

label {
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 14px;
}

input,
textarea,
select {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #dcdcdc;
  font-size: 14px;
  transition: 0.2s ease;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #1f3c88;
  box-shadow: 0 0 0 2px rgba(31, 60, 136, 0.15);
}

textarea {
  resize: none;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 15px;
}

button {
  margin-top: 20px;
  padding: 14px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary {
  background: #1f3c88;
  color: white;
  width: 100%;
}

.btn-primary:hover {
  background: #162d63;
}

hr {
  margin: 50px 0;
  border: none;
  border-top: 1px solid #eee;
}

h3 {
  margin-bottom: 20px;
}

.image-preview {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin: 20px 0;
}

.image-preview img {
  width: 160px;
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid #eee;
}
</style>