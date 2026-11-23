import { api } from './api'

export const tutoriaService = {
    listAll: async () => (await api.get('/admin/tutorias')).data?.data || [],
    getById: async (id) => (await api.get(`/admin/tutorias/${id}`)).data?.data,
    create: async (payload) => (await api.post('/admin/tutoria', payload)).data,
    update: async (id, payload) => (await api.put(`/admin/tutoria/${id}`, payload)).data,
    remove: async (id) => (await api.delete(`/admin/tutoria/${id}`)).data,
    toggleEstado: async (id, estado) => (await api.put(`/admin/tutoria/${id}`, { estado })).data
}

export const extractTutoriaError = (error, fallback = 'Error al conectar con el servidor') =>
    error.response?.data?.message || error.response?.data?.error || error.response?.data?.msg || fallback