import axios from 'axios'

const baseURL = import.meta.env.VITE_BACKEND_URL
const authHeaders = (token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

export const ubicacionesService = {
    list: async (token) => {
        const { data } = await axios.get(`${baseURL}/mapa/ubicaciones`, { headers: authHeaders(token) })
        if (Array.isArray(data)) return data
        if (Array.isArray(data?.data)) return data.data
        if (Array.isArray(data?.ubicaciones)) return data.ubicaciones
        if (Array.isArray(data?.aulas)) return data.aulas
        return []
    },
    listByCategory: async (category, token) => {
        const { data } = await axios.get(`${baseURL}/mapa/categoria/${category}`, { headers: authHeaders(token) })
        if (Array.isArray(data)) return data
        if (Array.isArray(data?.data)) return data.data
        if (Array.isArray(data?.ubicaciones)) return data.ubicaciones
        if (Array.isArray(data?.aulas)) return data.aulas
        return []
    },
}

export const extractUbicacionError = (error, fallback = 'Error al conectar con el servidor') =>
    error.response?.data?.message || error.response?.data?.error || error.response?.data?.msg || fallback