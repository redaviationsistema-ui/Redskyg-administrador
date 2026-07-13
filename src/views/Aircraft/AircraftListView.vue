<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "@/supabase";

const router = useRouter();
const aeronaves = ref([]);
const loading = ref(false);

const formatUsd = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
};

const getGalleryImage = (images) => {
  if (!Array.isArray(images) || !images.length) return null;

  const firstImage = images[0];

  if (typeof firstImage === "string") {
    return firstImage;
  }

  if (firstImage && typeof firstImage === "object") {
    return (
      firstImage.url ||
      firstImage.imagen_url ||
      firstImage.publicUrl ||
      null
    );
  }

  return null;
};

const loadAircraft = async () => {
  loading.value = true;

  const { data, error } = await supabase
  .from("aircraft_fleet")
  .select(`
    id,
    name,
    aircraft_type,
    iata,
    rental_price_usd,
    cruise_speed_knots,
    national_expenses_usd,
    capacity_passengers,
    is_active,
    imagen_url,
    exterior_images,
    interior_images
  `);

  if (error) {
    console.error(error);
    loading.value = false;
    return;
  }

  aeronaves.value = data.map(item => ({
    id: item.id,
    nombre: item.name,
    categoria: item.aircraft_type,
    iata: item.iata,
    precio_renta_usd: item.rental_price_usd,
    velocidad_crucero_nudos: item.cruise_speed_knots,
    gastos_nacionales_usd: item.national_expenses_usd,
    capacidad_pasajeros: item.capacity_passengers,
    disponible: item.is_active,
    imagen:
      item.imagen_url ||
      getGalleryImage(item.exterior_images) ||
      getGalleryImage(item.interior_images)
  }));

  loading.value = false;
};
/* ===================================
   ELIMINAR
=================================== */
const deleteAircraft = async (id) => {
  const confirmDelete = confirm("¿Seguro que deseas eliminar esta aeronave?");
  if (!confirmDelete) return;

  loading.value = true;

  const { error } = await supabase
    .from("aircraft_fleet")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Error al eliminar la aeronave");
  } else {
    aeronaves.value = aeronaves.value.filter(item => item.id !== id);
  }

  loading.value = false;
};

onMounted(loadAircraft);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h2>Aeronaves</h2>
      <button class="btn-primary" @click="router.push('/aircraft/new')">
        + Nueva Aeronave
      </button>
    </div>

    <div class="table-card">
      <table class="styled-table">
        <thead>
  <tr>
    <th>Imagen</th>
    <th>Nombre</th>
    <th>IATA</th>
    <th>Categoría</th>
    <th>Precio por hora (USD)</th>
    <th>Velocidad crucero (knots)</th>
    <th>National Expenses USD</th>
    <th>Capacidad</th>
    <th>Disponible</th>
    <th>Acciones</th>
  </tr>
</thead>

<tbody>
  <tr v-for="item in aeronaves" :key="item.id">
    
    <td>
  <img
  v-if="item.imagen"
  :src="item.imagen"
  class="thumbnail"
/>
</td>
    <td>{{ item.nombre }}</td>
    <td>{{ item.iata || "-" }}</td>
    <td>{{ item.categoria }}</td>
    <td>{{ formatUsd(item.precio_renta_usd) }}</td>
    <td>{{ item.velocidad_crucero_nudos || "-" }}</td>
    <td>{{ formatUsd(item.gastos_nacionales_usd) }}</td>
    <td>{{ item.capacidad_pasajeros }}</td>
    <td>
      <span :class="item.disponible ? 'badge-active' : 'badge-inactive'">
        {{ item.disponible ? "Disponible" : "No disponible" }}
      </span>
    </td>
  <td>
  <button
    class="btn-edit"
    @click="router.push(`/aircraft/edit/${item.id}`)"
  >
    Editar
  </button>

  <button
    class="btn-delete"
    @click="deleteAircraft(item.id)"
  >
    Eliminar
  </button>
</td>
  </tr>
</tbody>

      </table>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 30px;
  color: var(--text-main);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-strong);
}

.table-card {
  background: var(--bg-surface-solid);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
}

.styled-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1260px;
}

.styled-table th {
  text-align: left;
  padding: 12px;
  font-weight: 600;
  background: var(--bg-muted);
  color: var(--text-strong);
}

.styled-table td {
  padding: 12px;
  border-top: 1px solid var(--border-color);
  color: var(--text-main);
  vertical-align: middle;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%);
  color: white;
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: 0.3s;
}

.btn-primary:hover {
  filter: brightness(0.96);
}

.btn-edit {
  background: #ffc107;
  color: #000;
  padding: 6px 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

.badge-active {
  background: #d4edda;
  color: #155724;
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 12px;
}

.badge-inactive {
  background: #f8d7da;
  color: #721c24;
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 12px;
}

.thumbnail {
  width: 84px;
  height: 56px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  background: #eef2f7;
}
.thumbnail {
  width: 100px;
  height: 70px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  border: 1px solid var(--border-color);
}
.btn-delete {
  background: #dc3545;
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  margin-left: 8px;
  transition: 0.3s;
}

.btn-delete:hover {
  background: #b02a37;
}

:global(html[data-theme="dark"]) .table-card {
  background: var(--bg-surface-solid);
}

:global(html[data-theme="dark"]) .styled-table th {
  background: var(--bg-soft);
  color: var(--text-strong);
}

:global(html[data-theme="dark"]) .styled-table td {
  color: var(--text-main);
}
</style>
