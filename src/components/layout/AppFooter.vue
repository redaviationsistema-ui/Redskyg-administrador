<template>
  <footer class="footer">
    <span>© {{ new Date().getFullYear() }} SkyGroup Aviation</span>
    <span class="footer-dot">•</span>
    <span>Operational Admin Platform</span>
  </footer>
</template>

<style scoped>
.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 24px 24px;
  margin-top: 8px;
  border-top: 1px solid var(--border-color);
  color: var(--text-faint);
  font-size: 0.82rem;
}

.footer-dot {
  opacity: 0.6;
}

:global(html[data-theme="dark"]) .footer {
  background: rgba(255, 255, 255, 0.01);
}

@media (max-width: 640px) {
  .footer {
    flex-direction: column;
    gap: 4px;
  }

  .footer-dot {
    display: none;
  }
}
</style>
