import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-toastify'
import storeProfile from '../../context/storeProfile'
import storeAuth from '../../context/storeAuth'
import { profileService } from '../../services/profileServices'

const campoImagenPorRol = {
    admin:   'subirImagenAdmin',
    docente: 'subirImagenDocente',
    user:    'subirImagenEstudiante'
}

const useProfileForm = () => {
    const { user, setUser, profile } = storeProfile()
    const { rol, token } = storeAuth()
    const { register, handleSubmit, reset, formState: { errors } } = useForm()
    const [previewImagen, setPreviewImagen] = useState(null)

    const onSubmit = async (dataForm) => {
        try {
            const formData = new FormData()
            formData.append('nombre', dataForm.nombre)
            formData.append('apellido', dataForm.apellido)
            formData.append('telefono', dataForm.telefono)
            const campoImagen = campoImagenPorRol[rol] || 'subirImagenEstudiante'
            if (dataForm.imagen?.[0]) formData.append(campoImagen, dataForm.imagen[0])

            const updated = await profileService.update(user._id || user.id, rol, formData, token)
            setUser(updated)          // actualización inmediata (texto)
            await profile()           // datos reales del servidor (incluye la nueva foto)

            toast.success('¡Perfil actualizado con éxito!')
        } catch (error) {
            if (error.response?.status === 401) {
                toast.error('Tu sesión expiró. Inicia sesión nuevamente.')
                storeAuth.getState().logout()
                return
            }
            toast.error(error.response?.data?.msg || 'Error al actualizar perfil')
        }
    }

    const onError = () => toast.error('Por favor, revisa los campos obligatorios')

    const handleImagenChange = (e) => {
        const file = e.target.files?.[0]
        if (file) {
            setPreviewImagen((prev) => {
                if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
                return URL.createObjectURL(file)
            })
        }
    }

    useEffect(() => {
        if (user) {
            reset({
                nombre:   user?.nombre || '',
                apellido: user?.apellido || '',
                telefono: user?.telefono || user?.telfono || ''
            })
            setPreviewImagen(user?.imagen || null)
        }
    }, [user, reset])

    return { register, handleSubmit: handleSubmit(onSubmit, onError), errors, previewImagen, handleImagenChange }
}

export default useProfileForm