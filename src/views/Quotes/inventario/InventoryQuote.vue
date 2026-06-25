<script setup>
import { RouterLink } from "vue-router";

const cards = [
  {
    title: "Crear cotizacion",
    description:
      "Genera una nueva cotizacion de inventario y prepara la salida hacia PDF y validacion.",
    to: "/quotes/inventory/create",
    cta: "Nueva cotizacion",
  },
  {
    title: "En aviacion se gana asi",
    description:
      "Vista nueva enfocada en follow-up comercial y relacion con cliente dentro del flujo de aviacion.",
    to: "/quotes/aviation-sales",
    cta: "Abrir vista",
  },
  {
    title: "Validacion de cotizaciones",
    description:
      "Revisa cotizaciones emitidas, actualiza su estatus y cierra el proceso comercial.",
    to: "/quotes/validation",
    cta: "Ir a validacion",
  },
];
</script>

<template>
  <div class="page">
    <div class="hero">
      <p class="eyebrow">Inventory Quotes</p>
      <h1>Modulo de inventario</h1>
      <p class="subtitle">
        Punto de entrada para crear cotizaciones, revisar validaciones y abrir
        la nueva vista comercial enfocada en aviacion.
      </p>
    </div>

    <div class="cards-grid">
      <article v-for="card in cards" :key="card.title" class="card">
        <h2>{{ card.title }}</h2>
        <p>{{ card.description }}</p>

        <RouterLink :to="card.to" class="btn">
          {{ card.cta }}
        </RouterLink>
      </article>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  min-height: 100%;
  padding: 10px 0 36px;
  color: var(--text-main);
}

.hero {
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

h1 {
  margin: 0 0 10px;
  font-size: 38px;
  color: #0f172a;
  letter-spacing: -0.04em;
}

.subtitle {
  max-width: 760px;
  margin: 0;
  line-height: 1.6;
  color: #475569;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 22px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  border-radius: 22px;
  background: var(--bg-surface-solid, #fff);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.06);
}

.card h2 {
  margin: 0;
  font-size: 22px;
  color: #0f172a;
  letter-spacing: -0.03em;
}

.card p {
  margin: 0;
  line-height: 1.6;
  color: #475569;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  padding: 12px 16px;
  border-radius: 12px;
  background: #0f5fa6;
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  transition: transform 0.2s ease, background 0.2s ease;
}

.btn:hover {
  background: #0b4f89;
  transform: translateY(-1px);
}

@media (max-width: 980px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .hero,
  .card {
    padding: 20px;
  }

  h1 {
    font-size: 31px;
  }
}
</style>
