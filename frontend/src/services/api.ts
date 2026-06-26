import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  r => r,
  async error => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }
      originalRequest._retry = true
      isRefreshing = true
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const r = await axios.post(
            `${api.defaults.baseURL}/auth/refresh/`,
            { refresh }
          )
          const token = r.data.access
          localStorage.setItem('token', token)
          api.defaults.headers.Authorization = `Bearer ${token}`
          processQueue(null, token)
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        } catch (err) {
          processQueue(err, null)
          localStorage.removeItem('token')
          localStorage.removeItem('refresh')
          window.location.href = '/login'
          return Promise.reject(err)
        } finally {
          isRefreshing = false
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
