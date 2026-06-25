<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import AppFooter from "@/components/layout/AppFooter.vue";

const mobileBreakpoint = 1024;
const sidebarOpen = ref(false);

function syncSidebarState() {
  if (window.innerWidth > mobileBreakpoint) {
    sidebarOpen.value = false;
  }
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function closeSidebar() {
  sidebarOpen.value = false;
}

onMounted(() => {
  syncSidebarState();
  window.addEventListener("resize", syncSidebarState);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncSidebarState);
});
</script>

<template>
  <div class="layout" :class="{ 'sidebar-open': sidebarOpen }">
    <div
      v-if="sidebarOpen"
      class="sidebar-overlay"
      @click="closeSidebar"
    ></div>

    <AppSidebar :mobile-open="sidebarOpen" @close="closeSidebar" />

    <div class="main-shell">
      <AppHeader
        :sidebar-open="sidebarOpen"
        @toggle-sidebar="toggleSidebar"
      />

      <main class="content">
        <RouterView />
      </main>

      <AppFooter />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
  width: 100%;
  align-items: stretch;
}

.main-shell {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  min-width: 0;
  padding: 24px;
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  z-index: 29;
  background: rgba(8, 17, 31, 0.46);
  backdrop-filter: blur(4px);
}

@media (max-width: 1024px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .content {
    padding: 18px;
  }
}

@media (max-width: 640px) {
  .content {
    padding: 14px;
  }
}
</style>
