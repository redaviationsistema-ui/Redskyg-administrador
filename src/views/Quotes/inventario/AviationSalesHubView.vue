<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const pillars = computed(() => [
  {
    title: "Follow-up",
    highlight: "CLAVE en aviacion",
    description:
      "El cliente rara vez compra en el primer contacto. El seguimiento ordenado mantiene viva la oportunidad y acelera el cierre.",
    bullets: [
      "Programa el proximo contacto antes de terminar la conversacion actual.",
      "Da seguimiento con contexto: ruta, necesidad, urgencia y decision maker.",
      "Convierte cada cotizacion en una conversacion activa, no en un envio aislado.",
    ],
    cta: "Ir a seguimiento",
    routeName: "QuotesFollowUp",
  },
  {
    title: "Relacion con cliente",
    highlight: "La confianza vende",
    description:
      "En aviacion ejecutiva, la relacion pesa tanto como el precio. La confianza, la rapidez y la claridad hacen que el cliente regrese.",
    bullets: [
      "Registra preferencias, historial y objeciones para personalizar cada propuesta.",
      "Cuida los tiempos de respuesta; la percepcion de servicio define mucho la decision.",
      "Mantente presente aun cuando la venta no cierre hoy.",
    ],
    cta: "Ir a validacion",
    routeName: "QuotesValidation",
  },
]);

function openRoute(routeName) {
  router.push({ name: routeName });
}
</script>

<template>
  <div class="page">
    <section class="hero">
      <p class="eyebrow">Aviation Sales</p>
      <h1>En aviacion se gana asi</h1>
      <p class="hero-copy">
        No gana solo la mejor cotizacion. Gana el equipo que da seguimiento,
        entiende al cliente y construye confianza durante todo el proceso.
      </p>

      <div class="hero-actions">
        <button class="primary-btn" @click="openRoute('QuotesFollowUp')">
          Abrir follow-up
        </button>
        <button class="secondary-btn" @click="openRoute('QuotesValidation')">
          Abrir relacion con cliente
        </button>
      </div>
    </section>

    <section class="pillars-grid">
      <article
        v-for="pillar in pillars"
        :key="pillar.title"
        class="pillar-card"
      >
        <div class="card-top">
          <p class="card-kicker">{{ pillar.highlight }}</p>
          <h2>{{ pillar.title }}</h2>
          <p class="card-description">{{ pillar.description }}</p>
        </div>

        <ul class="points-list">
          <li v-for="point in pillar.bullets" :key="point">
            {{ point }}
          </li>
        </ul>

        <button class="card-btn" @click="openRoute(pillar.routeName)">
          {{ pillar.cta }}
        </button>
      </article>
    </section>
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
  position: relative;
  overflow: hidden;
  padding: 34px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(14, 116, 144, 0.22), transparent 30%),
    radial-gradient(circle at bottom right, rgba(245, 158, 11, 0.16), transparent 28%),
    linear-gradient(135deg, #082f49 0%, #0f5fa6 55%, #d97706 100%);
  color: #fff;
  box-shadow: 0 24px 50px rgba(8, 47, 73, 0.24);
}

.eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.74);
}

h1 {
  margin: 0 0 12px;
  font-size: 42px;
  line-height: 1;
  letter-spacing: -0.04em;
}

.hero-copy {
  max-width: 720px;
  margin: 0;
  font-size: 16px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.88);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.primary-btn,
.secondary-btn,
.card-btn {
  border: none;
  border-radius: 14px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.primary-btn {
  background: #fff;
  color: #0f3d75;
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.26);
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 24px;
}

.pillar-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
  padding: 28px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(241, 245, 249, 0.96));
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.08);
}

.card-kicker {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0f5fa6;
}

.pillar-card h2 {
  margin: 0 0 10px;
  font-size: 28px;
  color: #0f172a;
  letter-spacing: -0.03em;
}

.card-description {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: #475569;
}

.points-list {
  margin: 0;
  padding-left: 18px;
  color: #334155;
  line-height: 1.7;
}

.card-btn {
  align-self: flex-start;
  background: linear-gradient(135deg, #0f5fa6 0%, #0b4f89 100%);
  color: #fff;
  box-shadow: 0 14px 28px rgba(15, 95, 166, 0.2);
}

.primary-btn:hover,
.secondary-btn:hover,
.card-btn:hover {
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .pillars-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 26px;
  }

  h1 {
    font-size: 34px;
  }
}

@media (max-width: 640px) {
  .page {
    padding-bottom: 24px;
  }

  .hero {
    padding: 22px;
  }

  h1 {
    font-size: 30px;
  }

  .hero-copy {
    font-size: 14px;
  }

  .pillar-card {
    padding: 22px;
  }
}
</style>
