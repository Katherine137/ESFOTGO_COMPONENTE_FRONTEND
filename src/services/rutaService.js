import { api } from './api'

export const rutaService = {
    list: async () => {
        const { data } = await api.get('/admin/bus/rutas')
        const result = data?.data || data
        return Array.isArray(result) ? result : []
    }
}