import { api } from './api'

const enc = encodeURIComponent

const loginPath    = { admin: '/admin/login', docente: '/docente/login', user: '/estudiantes/login' }
const registerPath = { docente: '/docente/registro', user: '/estudiantes/registro' }
const buscarPath   = { docente: '/buscarDocente', user: '/buscarEstudiante' }

export const authService = {
    login: async (rol, credentials) =>
        (await api.post(loginPath[rol] ?? loginPath.user, credentials)).data,

    register: async (rol, payload) => {
        const { rol: _ignorado, ...body } = payload
        return (await api.post(registerPath[rol] ?? registerPath.user, body)).data
    },

    buscarPerfil: async (rol, email) => {
        const path = buscarPath[rol]
        if (!path) return null
        return (await api.get(path, { params: { email } })).data
    },

    recuperarPassword: async (email) =>
        (await api.post('/recuperarpassword', { email })).data,

    verificarToken: async (token) =>
        (await api.get(`/recuperarpassword/${enc(token)}`)).data,

    nuevoPassword: async (token, payload) =>
        (await api.post(`/nuevopassword/${enc(token)}`, payload)).data
}