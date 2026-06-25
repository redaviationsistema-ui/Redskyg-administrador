import { defineStore } from 'pinia'
import * as authService from '@/services/auth.service'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: true,
  }),

  actions: {
    async init() {
      this.user = await authService.getSession()
      this.loading = false
    },

    async login(email, password) {
      this.user = await authService.login(email, password)
    },

    async logout() {
      await authService.logout()
      this.user = null
    },
  },
})
