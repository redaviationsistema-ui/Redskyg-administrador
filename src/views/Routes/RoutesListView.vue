<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '@/supabase'
import BaseTable from '@/components/ui/BaseTable.vue'

const routes = ref([])

onMounted(async () => {
  const { data } = await supabase
    .from('quote_routes')
    .select('*')

  routes.value = data
})
</script>

<template>
  <section>
    <h1>Rutas</h1>

    <BaseTable :rows="routes">
      <template #columns>
        <th>Origen</th>
        <th>Destino</th>
        <th>Pasajeros</th>
      </template>

      <template #row="{ row }">
        <td>{{ row.from_airport }}</td>
        <td>{{ row.to_airport }}</td>
        <td>{{ row.passengers }}</td>
      </template>
    </BaseTable>
  </section>
</template>
