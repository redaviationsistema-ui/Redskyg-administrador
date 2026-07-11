import { defineStore } from 'pinia'
import * as authService from '@/services/auth.service'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    inventoryUser: null,
    inventoryError: '',
    loading: true,
    initialized: false,
  }),

  actions: {
    async init() {
      this.loading = true
      const [user, inventoryUser] = await Promise.all([
        authService.getCurrentUser(),
        authService.getInventoryCurrentUser(),
      ])
      this.user = user
      this.inventoryUser = inventoryUser
      this.inventoryError = ''
      this.loading = false
      this.initialized = true
    },

    async login(email, password) {
      this.user = await authService.login(email, password)
      this.inventoryError = ''
      this.initialized = true
      return this.user
    },

    async loginInventory(email, password) {
      this.inventoryUser = await authService.loginInventory(email, password)
      this.inventoryError = ''
      this.initialized = true
      return this.inventoryUser
    },

    async logout() {
      await authService.logout()
      this.user = null
      this.inventoryUser = null
      this.inventoryError = ''
      this.initialized = true
    },
  },
})
