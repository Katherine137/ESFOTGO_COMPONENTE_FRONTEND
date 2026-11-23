import { api } from './api'

export const docenteService = {
    list: async () => {
        const { data } = await api.get('/docentes')
        return Array.isArray(data) ? data : data?.data || data?.docentes || []
    },
    remove: async (id) => (await api.delete(`/admin/eliminardocente/${id}`)).data,
    update: async (id, payload) => (await api.put(`/actualizardocente/${id}`, payload)).data,
    uploadExcel: async (formData) => (await api.post('/admin/upload', formData)).data
}