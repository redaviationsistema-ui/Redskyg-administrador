<script setup>
defineProps({
  sidebarOpen: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["toggle-sidebar"]);

import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/composables/useTheme";

const auth = useAuthStore();
const { theme, toggleTheme } = useTheme();
</script>

<template>
  <header class="app-header">
    <button
      class="menu-toggle"
      :aria-expanded="sidebarOpen ? 'true' : 'false'"
      aria-label="Open navigation menu"
      @click="$emit('toggle-sidebar')"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div class="header-copy">
      <p class="eyebrow">Operations Console</p>
      <h1 class="logo">SkyGroup Admin</h1>
    </div>

    <div class="actions">
      <button class="theme-toggle" @click="toggleTheme">
        {{ theme === "light" ? "Dark mode" : "Light mode" }}
      </button>

      <div class="user-chip">
        <span class="user-label">Signed in as</span>
        <strong>{{ auth.user?.email || "admin@dev.local" }}</strong>
      </div>

      <button class="logout-btn" @click="auth.logout()">Sign out</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 18px 24px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(16px);
}

.menu-toggle {
  display: none;
  width: 46px;
  height: 46px;
  padding: 0;
  border-radius: 14px;
  background: var(--bg-surface-solid);
  border: 1px solid var(--border-color);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
}

.menu-toggle span {
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: var(--text-strong);
}

.header-copy {
  min-width: 0;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary);
}

.logo {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--text-strong);
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.theme-toggle,
.logout-btn {
  min-height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.theme-toggle {
  background: var(--bg-surface-solid);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.logout-btn {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%);
  color: white;
  box-shadow: 0 10px 24px rgba(15, 95, 166, 0.24);
}

.theme-toggle:hover,
.logout-btn:hover {
  transform: translateY(-1px);
}

.user-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 220px;
  padding: 9px 14px;
  border-radius: 14px;
  background: var(--bg-surface-solid);
  border: 1px solid var(--border-color);
}

.user-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.user-chip strong {
  color: var(--text-strong);
  font-size: 13px;
}

@media (max-width: 900px) {
  .app-header {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 16px 18px;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .actions {
    width: 100%;
    justify-content: flex-start;
  }

  .user-chip {
    min-width: 0;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .logo {
    font-size: 20px;
  }

  .theme-toggle,
  .logout-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
