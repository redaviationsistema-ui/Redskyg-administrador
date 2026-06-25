<script setup>
import { ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits(['submit'])

const form = ref({
  iata: '',
  ciudad: '',
  country: '',
  latitude: '',
  longitude: ''
})

const submit = () => {
  emit('submit', form.value)
}
</script>

<template>
  <form @submit.prevent="submit">
    <label>
      Código IATA
      <input v-model="form.iata" maxlength="3" required />
    </label>

    <label>
      Ciudad
      <input v-model="form.ciudad" required />
    </label>

    <label>
      País
      <input v-model="form.country" required />
    </label>

    <label>
      Latitud
      <input v-model="form.latitude" />
    </label>

    <label>
      Longitud
      <input v-model="form.longitude" />
    </label>

    <BaseButton type="submit">
      Guardar aeropuerto
    </BaseButton>
  </form>
</template>

<style scoped>
form {
  display: grid;
  gap: 1rem;
}
</style>
