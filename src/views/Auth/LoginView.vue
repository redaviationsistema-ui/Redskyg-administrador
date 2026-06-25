<template>
  <div class="login">
    <h1>Iniciar sesion</h1>

    <form @submit.prevent="submit">
      <input
        v-model="email"
        type="email"
        placeholder="Email"
        required
      />

      <input
        v-model="password"
        type="password"
        placeholder="Contrasena"
        required
      />

      <button type="submit" :disabled="loading">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </button>

      <p v-if="error" class="error">
        {{ error }}
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const submit = async () => {
  error.value = ''
  loading.value = true

  try {
    await auth.login(email.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e?.message || 'Credenciales incorrectas'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login {
  max-width: 320px;
  margin: 6rem auto;
  padding: 2rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  margin-bottom: 1.5rem;
}

form {
  display: grid;
  gap: 1rem;
}

input {
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
}

button {
  padding: 0.6rem;
  border-radius: 6px;
  border: none;
  background: #2563eb;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #dc2626;
  font-size: 0.85rem;
  text-align: center;
}
</style>
