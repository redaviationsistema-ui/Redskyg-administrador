import { ref, computed } from 'vue'

export const usePagination = (items, perPage = 10) => {
  const currentPage = ref(1)

  const totalPages = computed(() =>
    Math.ceil(items.value.length / perPage)
  )

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * perPage
    return items.value.slice(start, start + perPage)
  })

  const nextPage = () => {
    if (currentPage.value < totalPages.value) currentPage.value++
  }

  const prevPage = () => {
    if (currentPage.value > 1) currentPage.value--
  }

  return {
    currentPage,
    totalPages,
    paginatedItems,
    nextPage,
    prevPage
  }
}
