import axios from 'axios'
import storeAuth from '../context/storeAuth'
import storeProfile from '../context/storeProfile'

const baseURL = import.meta.env.VITE_BACKEND_URL
if (import.meta.env.PROD && !baseURL?.startsWith('https://')) {
    throw new Error('VITE_BACKEND_URL debe usar HTTPS')
}

export const api = axios.create({ baseURL, timeout: 15000 })

api.interceptors.request.use((cfg) => {
    const t = storeAuth.getState().token
    if (t) cfg.headers.Authorization = `Bearer ${t}`
    return cfg
})

api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401 && storeAuth.getState().token) {
        storeAuth.getState().logout()
        storeProfile.getState().clearUser()
        }
        return Promise.reject(err)
    }
)