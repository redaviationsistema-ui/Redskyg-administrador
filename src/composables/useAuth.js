import { ref, onMounted } from 'vue'
import * as authService from '@/services/auth.service'

const user = ref(null)
const loading = ref(true)

export const useAuth = () => {
  const loadUser = async () => {
    user.value = await authService.getSession()
    loading.value = false
  }

  const login = async (email, password) => {
    user.value = await authService.login(email, password)
  }

  const logout = async () => {
    await authService.logout()
    user.value = null
  }

  onMounted(loadUser)

  return {
    user,
    loading,
    login,
    logout
  }
}
