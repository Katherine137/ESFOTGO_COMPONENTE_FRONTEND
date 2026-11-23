import { api } from './api'

const toArray = (data) => {
    if (Array.isArray(data)) return data
    return data?.data ?? data?.ubicaciones ?? data?.aulas ?? []
}

export const ubicacionesService = {
    list: async () => toArray((await api.get('/mapa/ubicaciones')).data),
    listByCategory: async (category) =>
        toArray((await api.get(`/mapa/categoria/${encodeURIComponent(category)}`)).data)
}

export const extractUbicacionError = (error, fallback = 'Error al conectar con el servidor') =>
    error.response?.data?.message || error.response?.data?.error || error.response?.data?.msg || fallback