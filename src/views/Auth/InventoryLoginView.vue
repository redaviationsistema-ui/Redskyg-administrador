<template>
  <div class="login">
    <div class="login-card">
      <p class="eyebrow">Inventory Access</p>
      <h1>Acceso a Correos Masivos</h1>
      <p class="subtitle">
        Esta sección usa una base distinta. Inicia sesión con las credenciales de Inventory para continuar.
      </p>

      <form @submit.prevent="submit">
        <input
          v-model="email"
          type="email"
          placeholder="Email Inventory"
          required
        />

        <input
          v-model="password"
          type="password"
          placeholder="Contraseña"
          required
        />

        <button type="submit" :disabled="loading">
          {{ loading ? 'Entrando...' : 'Entrar a Correos Masivos' }}
        </button>

        <button type="button" class="secondary-btn" :disabled="loading" @click="router.push('/')">
          Volver al admin
        </button>

        <p v-if="error" class="error">
          {{ error }}
        </p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref(auth.user?.email || '')
const password = ref('')
const error = ref('')
const loading = ref(false)

const submit = async () => {
  error.value = ''
  loading.value = true

  try {
    await auth.loginInventory(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/correos-masivos'
    router.push(redirect)
  } catch (e) {
    error.value = e?.message || 'Credenciales de Inventory incorrectas'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(15, 95, 166, 0.14), transparent 28%),
    linear-gradient(180deg, #f5f8fc 0%, #edf2f8 100%);
}

.login-card {
  width: min(460px, 100%);
  padding: 32px;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.1);
}

.eyebrow {
  margin: 0 0 6px;
  color: #0f5fa6;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 10px;
  color: #08111f;
}

.subtitle {
  margin: 0 0 22px;
  color: #5f7187;
}

form {
  display: grid;
  gap: 14px;
}

input {
  padding: 0.8rem 0.9rem;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
}

button {
  min-height: 46px;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #0f5fa6 0%, #0b4c86 100%);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.secondary-btn {
  background: white;
  color: #102033;
  border: 1px solid #cbd5e1;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #dc2626;
  font-size: 0.9rem;
  text-align: center;
  margin: 4px 0 0;
}
</style>
