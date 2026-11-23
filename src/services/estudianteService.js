import { api } from './api'

export const estudianteService = {
    list: async () => {
        const { data } = await api.get('/estudiantes')
        return Array.isArray(data) ? data : data?.data || data?.estudiantes || []
    },
    remove: async (id) => (await api.delete(`/eliminarestudiante/${id}`)).data,
    update: async (id, payload) => (await api.put(`/actualizarestudiante/${id}`, payload)).data,
    uploadExcel: async (formData) => (await api.post('/admin/upload', formData)).data
}