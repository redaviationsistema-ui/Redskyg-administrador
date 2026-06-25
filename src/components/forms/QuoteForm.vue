<script setup>
import { ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits(['submit'])

const form = ref({
  full_name: '',
  email: '',
  passengers: 1,
  flight_type: 'one_way'
})

const submit = () => {
  emit('submit', form.value)
}
</script>

<template>
  <form @submit.prevent="submit">
    <label>
      Nombre
      <input v-model="form.full_name" required />
    </label>

    <label>
      Email
      <input type="email" v-model="form.email" required />
    </label>

    <label>
      Pasajeros
      <input type="number" v-model="form.passengers" min="1" />
    </label>

    <label>
      Tipo de vuelo
      <select v-model="form.flight_type">
        <option value="one_way">Solo ida</option>
        <option value="round_trip">Ida y vuelta</option>
      </select>
    </label>

    <BaseButton type="submit">
      Guardar cotización
    </BaseButton>
  </form>
</template>

<style scoped>
form {
  display: grid;
  gap: 1rem;
}
label {
  display: flex;
  flex-direction: column;
}
</style>
