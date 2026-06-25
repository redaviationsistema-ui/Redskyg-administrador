<template>
  <section class="settings">
    <!-- HEADER -->
    <header class="settings-header">
      <h1>Configuración</h1>
      <p>
        Ajustes generales del sistema y preferencias operativas
      </p>
    </header>

    <!-- GRID -->
    <div class="settings-grid">
      <!-- SISTEMA -->
      <div class="settings-card">
        <h2>Sistema</h2>

        <div class="setting-row">
          <span>Modo del sistema</span>
          <span class="badge">Producción</span>
        </div>

        <div class="setting-row">
          <span>Zona horaria</span>
          <span>México (GMT-6)</span>
        </div>

        <div class="setting-row">
          <span>Moneda base</span>
          <span>USD</span>
        </div>
      </div>

      <!-- AVIACIÓN -->
      <div class="settings-card">
        <h2>Parámetros de Aviación</h2>

        <div class="setting-row">
          <span>Unidad de distancia</span>
          <span>Millas náuticas (NM)</span>
        </div>

        <div class="setting-row">
          <span>Cálculo de rutas</span>
          <span>Gran círculo (Haversine)</span>
        </div>

        <div class="setting-row">
          <span>Tiempo estimado</span>
          <span>Automático</span>
        </div>
      </div>

      <!-- USUARIO -->
      <div class="settings-card">
        <h2>Cuenta</h2>

        <div class="setting-row">
          <span>Usuario activo</span>
          <span>admin@dev.local</span>
        </div>

        <div class="setting-row">
          <span>Rol</span>
          <span>Administrador</span>
        </div>

        <div class="setting-row">
          <span>Sesión</span>
          <span class="status ok">Activa</span>
        </div>
      </div>

      <!-- FUTURO -->
      <div class="settings-card muted">
        <h2>Próximamente</h2>
        <p>
          Gestión de usuarios, roles, permisos,
          costos por aeronave y exportación avanzada.
        </p>
      </div>
    </div>
  </section>
</template>

<style>

/* =========================
   SETTINGS LAYOUT
========================= */
.settings {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* =========================
   HEADER
========================= */
.settings-header {
  background: linear-gradient(
    135deg,
    var(--primary-dark),
    var(--primary-dark-2)
  );
  color: white;
  padding: 2rem;
  border-radius: 14px;
}

.settings-header h1 {
  margin: 0;
  font-size: 1.8rem;
}

.settings-header p {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: #cbd5e1;
}

/* =========================
   GRID
========================= */
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
}

/* =========================
   CARD
========================= */
.settings-card {
  background: var(--bg-card);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-card h2 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text-main);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
}

/* =========================
   ROWS
========================= */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--text-main);
}

.setting-row span:last-child {
  color: var(--text-muted);
}

/* =========================
   BADGES / STATUS
========================= */
.badge {
  background: #2563eb;
  color: white;
  font-size: 0.7rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
}

.status {
  font-weight: 600;
}

.status.ok {
  color: #16a34a;
}

/* =========================
   MUTED CARD
========================= */
.settings-card.muted {
  background: var(--bg-muted);
  color: var(--text-muted);
  text-align: center;
}

.settings-card.muted h2 {
  color: var(--text-muted);
  border-bottom: none;
}

.settings-card.muted p {
  font-size: 0.85rem;
  line-height: 1.5;
}

</style>