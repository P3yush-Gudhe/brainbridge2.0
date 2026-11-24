import axios from 'axios'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/stores/authStore'

export async function getFreshIdToken(forceRefresh = false): Promise<string | null> {
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken(forceRefresh)
    } catch {
      return useAuthStore.getState().token
    }
  }
  return useAuthStore.getState().token
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const token = await getFreshIdToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      const freshToken = await getFreshIdToken(true)
      if (freshToken) {
        originalRequest.headers.Authorization = `Bearer ${freshToken}`
        return api(originalRequest)
      }
      await useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
