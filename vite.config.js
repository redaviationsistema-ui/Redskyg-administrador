import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  base: '/administrador/',   // 👈 ESTA LÍNEA ES LA CLAVE
  plugins: [vue()],
  server: {
    proxy: {
      '/bulk-email-api': {
        target: 'https://redskyg.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/administrador/bulk-email.php',
      },
      '/bulk-email-send-api': {
        target: 'https://redskyg.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/administrador/bulk_email_send.php',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})
