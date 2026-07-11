import { defineStore } from 'pinia'
import * as authService from '@/services/auth.service'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: true,
    initialized: false,
  }),

  actions: {
    async init() {
      this.loading = true
      this.user = await authService.getCurrentUser()
      this.loading = false
      this.initialized = true
    },

    async login(email, password) {
      this.user = await authService.login(email, password)
      this.initialized = true
    },

    async logout() {
      await authService.logout()
      this.user = null
      this.initialized = true
    },
  },
})
