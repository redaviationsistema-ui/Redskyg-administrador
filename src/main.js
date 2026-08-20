
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth.store'
import '@/assets/main.css'

document.documentElement.lang = 'es-MX'
document.documentElement.setAttribute('xml:lang', 'es-MX')

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

useAuthStore().init()

app.mount('#app')
