import { api } from './api'

const perfilPath = { admin: '/admin/perfil', docente: '/docente/perfil', user: '/perfil' }
const updatePath = {
    admin:   (id) => `/admin/actualizarperfil/${id}`,
    docente: (id) => `/docente/actualizarperfil/${id}`,
    user:    (id) => `/actualizarperfil/${id}`
}

const extractUser = (data) =>
    data?.data || data?.administradorBDD || data?.estudiantesBDD || data?.docenteBDD || data

export const profileService = {
    get: async (rol) => extractUser((await api.get(perfilPath[rol] || perfilPath.user)).data),

    update: async (id, rol, formData) => {
        const path = updatePath[rol]?.(id) || `/actualizarperfil/${id}`
        return extractUser((await api.put(path, formData)).data)
    },

    updatePassword: async (id, payload) =>
        (await api.put(`/actualizarpassword/${id}`, payload)).data
}