import { api } from './api'

export const eventService = {
    listPublic: async () => {
        const { data } = await api.get('/eventos')
        return Array.isArray(data) ? data : data?.data || data?.eventos || []
    },
    listPrivate: async () => {
        const { data } = await api.get('/eventos')
        const result = data?.data || data
        return Array.isArray(result) ? result : []
    },
    getById: async (id) => {
        const { data } = await api.get(`/verevento/${id}`)
        return data?.data || data
    },
    create: async (payload) => (await api.post('/admin/evento', payload)).data,
    update: async (id, payload) => (await api.put(`/admin/actualizarevento/${id}`, payload)).data,
    remove: async (id) => (await api.delete(`/admin/eliminarevento/${id}`)).data,
    listUbicaciones: async () => {
        const { data } = await api.get('/mapa/ubicaciones')
        return data?.data || []
    }
}

export const extractApiError = (error, fallback = 'Error al conectar con el servidor') =>
    error.response?.data?.message || error.response?.data?.error || error.response?.data?.msg || fallback