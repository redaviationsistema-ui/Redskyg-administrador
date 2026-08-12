<script setup>
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";

defineProps({
  mobileOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close"]);

const route = useRoute();
const openQuotesWorkspace = ref(true);
const openSalesFollowUp = ref(true);
const openAircraftForms = ref(true);

const mainLinks = [
  { to: "/", label: "Dashboard", hint: "Overview" },
  { to: "/comercial", label: "Centro Comercial", hint: "Pipeline y ventas" },
  { to: "/aircraft", label: "Aircraft", hint: "Fleet" },
  { to: "/lookbooks", label: "Lookbooks", hint: "Library" },
  { to: "/admin/experiencias", label: "Experiencias", hint: "Contenido web" },
  { to: "/correos-masivos", label: "Correos masivos", hint: "Campaigns" },
  { to: "/response-templates", label: "Plantillas de respuesta", hint: "Respuestas rápidas" },
  { to: "/airports", label: "Airports", hint: "Directory" },
  { to: "/nautical-miles", label: "Nautical Miles", hint: "Distance tools" },
  { to: "/routes", label: "Routes", hint: "Planning" },
  { to: "/settings", label: "Settings", hint: "Configuration" },
];

const quoteLinks = [
  { to: "/quotes", label: "Cotizaciones web" },
  { to: "/quotes/admin", label: "Cotizaciones admin de vuelo" },
  { to: "/quotes/flight/create", label: "Crear cotizacion de vuelo" },
  { to: "/quotes/web-calculator", label: "Cotizador web" },
  { to: "/quotes/validation", label: "Cola de validacion" },
  { to: "/quotes/inventory/create", label: "Cotizaciones de inventario" },
  { to: "/quotes/aviation-parts", label: "Partes de aviacion" },
];

const quoteSectionActive = computed(() => route.path.startsWith("/quotes"));
const salesSectionActive = computed(() => route.path === "/quotes/follow-up");
const aircraftFormsSectionActive = computed(() => route.path.startsWith("/aircraft-forms"));

</script>

<template>
  <aside class="sidebar" :class="{ 'mobile-open': mobileOpen }">
    <div class="sidebar-inner">
      <button
        type="button"
        class="sidebar-close"
        aria-label="Close navigation menu"
        @click="emit('close')"
      >
        Close
      </button>

      <div class="brand-shell">
        <div class="brand">
          <div class="brand-mark">SG</div>
          <div class="brand-copy">
            <span class="logo">Sky Group</span>
            <span class="tag">Aviation Admin</span>
          </div>
        </div>

        <div class="status-pill">
          <span class="status-dot"></span>
          <span>Operations online</span>
        </div>
      </div>

      <div class="nav-section">
        <p class="section-title">Main Navigation</p>

        <nav class="nav-list">
          <RouterLink
            v-for="link in mainLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link"
            @click="emit('close')"
          >
            <div class="nav-copy">
              <strong>{{ link.label }}</strong>
              <span>{{ link.hint }}</span>
            </div>
          </RouterLink>
        </nav>
      </div>

      <div class="nav-section nav-section-quotes">
        <button
          class="section-toggle"
          :class="{ active: quoteSectionActive }"
          @click="openQuotesWorkspace = !openQuotesWorkspace"
        >
          <div class="nav-copy">
            <strong>Espacio de cotizaciones</strong>
            <span>Cotizaciones y validacion</span>
          </div>
          <span class="chevron">{{ openQuotesWorkspace ? "-" : "+" }}</span>
        </button>

        <div v-if="openQuotesWorkspace" class="submenu">
          <RouterLink
            v-for="link in quoteLinks"
            :key="link.to"
            :to="link.to"
            class="nav-sublink"
            @click="emit('close')"
          >
            {{ link.label }}
          </RouterLink>

        </div>
      </div>

      <div class="nav-section nav-section-quotes">
        <button
          class="section-toggle"
          :class="{ active: salesSectionActive }"
          @click="openSalesFollowUp = !openSalesFollowUp"
        >
          <div class="nav-copy">
            <strong>Seguimiento y validación</strong>
            <span>Pipeline comercial y responsables</span>
          </div>
          <span class="chevron">{{ openSalesFollowUp ? "-" : "+" }}</span>
        </button>

        <div v-if="openSalesFollowUp" class="submenu">
          <RouterLink to="/quotes/follow-up" class="nav-sublink" @click="emit('close')">
            Seguimiento de ventas
          </RouterLink>

         
        </div>
      </div>

      <div class="nav-section nav-section-quotes">
        <button
          class="section-toggle"
          :class="{ active: aircraftFormsSectionActive }"
          @click="openAircraftForms = !openAircraftForms"
        >
          <div class="nav-copy">
            <strong>Forms de aviones</strong>
            <span>Respuestas de prospectos</span>
          </div>
          <span class="chevron">{{ openAircraftForms ? "-" : "+" }}</span>
        </button>

        <div v-if="openAircraftForms" class="submenu">
          <RouterLink to="/aircraft-forms/responses" class="nav-sublink" @click="emit('close')">
            Respuestas
          </RouterLink>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  z-index: 30;
  align-self: stretch;
  min-height: 100vh;
  padding: 18px;
  background: transparent;
  overflow: hidden;
}

.sidebar-inner {
  min-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border-color);
  border-radius: 30px;
  background:
    radial-gradient(circle at top left, rgba(15, 95, 166, 0.12), transparent 28%),
    linear-gradient(180deg, var(--bg-surface-solid), var(--bg-soft));
  box-shadow: var(--shadow-md);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(15, 95, 166, 0.28) transparent;
}

.sidebar-inner::-webkit-scrollbar {
  width: 8px;
}

.sidebar-inner::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(15, 95, 166, 0.24);
}

.sidebar-close {
  display: none;
  align-self: flex-end;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(15, 95, 166, 0.08);
  color: var(--primary);
  font-weight: 700;
  cursor: pointer;
}

.brand-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 4px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: linear-gradient(135deg, #0f5fa6 0%, #0b4c86 100%);
  color: white;
  font-weight: 900;
  font-size: 1rem;
  letter-spacing: 0.08em;
  box-shadow: 0 16px 30px rgba(15, 95, 166, 0.2);
}

.brand-copy {
  display: flex;
  flex-direction: column;
}

.logo {
  color: var(--text-strong);
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.tag {
  margin-top: 4px;
  color: var(--text-faint);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 800;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.16);
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  margin: 0;
  color: var(--text-faint);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-link,
.section-toggle,
.nav-sublink {
  width: 100%;
  border-radius: 16px;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease;
}

.nav-link,
.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 10px 14px;
  color: var(--text-main);
}

.nav-link {
  text-decoration: none;
}

.section-toggle {
  border: none;
  background: rgba(15, 95, 166, 0.04);
  cursor: pointer;
}

.nav-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}

.nav-copy strong {
  font-size: 0.9rem;
  font-weight: 800;
  color: inherit;
}

.nav-copy span {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.25;
}

.nav-link:hover,
.section-toggle:hover,
.nav-sublink:hover {
  transform: translateX(2px);
  background: var(--bg-hover);
}

.nav-link.router-link-active,
.section-toggle.active {
  background: linear-gradient(135deg, var(--primary-soft), rgba(15, 95, 166, 0.04));
  box-shadow: inset 0 0 0 1px rgba(15, 95, 166, 0.16);
}

.nav-link.router-link-active .nav-copy strong,
.section-toggle.active .nav-copy strong,
.nav-sublink.router-link-active {
  color: var(--primary);
}

.nav-section-quotes {
  padding: 8px;
  border-radius: 20px;
  background: rgba(15, 95, 166, 0.03);
  border: 1px solid rgba(15, 95, 166, 0.08);
}

.submenu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  padding: 0 0 4px 12px;
  border-left: 1px solid rgba(15, 95, 166, 0.1);
}

.nav-sublink {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 12px;
  color: var(--text-muted);
  font-size: 0.84rem;
  text-decoration: none;
}

.nav-sublink.router-link-active {
  background: rgba(15, 95, 166, 0.08);
  box-shadow: inset 0 0 0 1px rgba(15, 95, 166, 0.12);
}

.responsables-box {
  margin-top: 8px;
  padding: 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(15, 95, 166, 0.08), rgba(15, 95, 166, 0.02));
  border: 1px solid rgba(15, 95, 166, 0.1);
}

.responsables-title {
  display: block;
  margin-bottom: 10px;
  color: #0f5fa6;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.responsables-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 4px;
}

.responsable-chip {
  display: block;
  padding: 9px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-main);
  font-size: 0.82rem;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(15, 95, 166, 0.08);
}

.responsables-list::-webkit-scrollbar {
  width: 6px;
}

.responsables-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(15, 95, 166, 0.18);
}

.chevron {
  color: var(--text-faint);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

.sidebar-card {
  margin-top: auto;
  padding: 16px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(15, 95, 166, 0.08), rgba(15, 95, 166, 0.03));
  border: 1px solid rgba(15, 95, 166, 0.1);
  color: var(--text-main);
}

.sidebar-card-label {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.sidebar-card strong {
  display: block;
  margin-bottom: 8px;
  font-size: 1rem;
  color: var(--text-strong);
}

.sidebar-card p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.55;
}

@media (max-height: 820px) {
  .sidebar-card {
    display: none;
  }

  .sidebar-inner {
    gap: 12px;
  }

  .responsables-list {
    max-height: 140px;
  }
}

@media (max-width: 1024px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    width: min(88vw, 320px);
    height: 100dvh;
    padding: 12px 12px max(20px, env(safe-area-inset-bottom));
    transform: translateX(-110%);
    transition: transform 0.24s ease;
    pointer-events: none;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
    pointer-events: auto;
  }

  .sidebar-inner {
    min-height: calc(100dvh - 24px);
    max-height: calc(100dvh - 24px);
    border-radius: 24px;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding-bottom: max(28px, env(safe-area-inset-bottom));
  }

  .sidebar-close {
    display: inline-flex;
  }

  .sidebar-card {
    margin-top: 4px;
  }

  .responsables-list {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }
}

@media (max-width: 768px) {
  .sidebar {
    padding: 12px 12px 0;
  }

  .sidebar-inner {
    padding: 16px;
    gap: 14px;
  }

  .sidebar-card {
    display: none;
  }
}

@media (max-width: 640px) {
  .sidebar {
    width: 100%;
    max-width: 100%;
    padding: 0;
  }

  .sidebar-inner {
    min-height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    padding-bottom: max(36px, env(safe-area-inset-bottom));
  }
}
</style>
