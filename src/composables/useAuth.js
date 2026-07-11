import { ref, onMounted } from 'vue'
import * as authService from '@/services/auth.service'

const user = ref(null)
const inventoryUser = ref(null)
const loading = ref(true)

export const useAuth = () => {
const loadUser = async () => {
    const [mainUser, inventoryCurrentUser] = await Promise.all([
      authService.getSession(),
      authService.getInventoryCurrentUser(),
    ])
    user.value = mainUser
    inventoryUser.value = inventoryCurrentUser
    loading.value = false
  }

  const login = async (email, password) => {
    user.value = await authService.login(email, password)
    return user.value
  }

  const loginInventory = async (email, password) => {
    inventoryUser.value = await authService.loginInventory(email, password)
    return inventoryUser.value
  }

  const logout = async () => {
    await authService.logout()
    user.value = null
    inventoryUser.value = null
  }

  onMounted(loadUser)

  return {
    user,
    inventoryUser,
    loading,
    login,
    loginInventory,
    logout
  }
}
