import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-toastify'
import { authService } from '../../services/authService'

const useForgot = () => {
    const { register, handleSubmit, formState: { errors }, reset } = useForm()
    const [loading, setLoading] = useState(false)

    const onSubmit = async (dataForm) => {
        setLoading(true)
        try {
            const response = await authService.recuperarPassword(dataForm.email)
            toast.success('Si el correo existe, recibirás un enlace de recuperación')
            reset()
        } catch (error) {
            console.error('Error completo:', error.response?.data || error.message)
            toast.error(
                error.response?.data?.msg ||
                error.response?.data?.error ||
                `Error ${error.response?.status || ''}: No se pudo enviar el correo`
            )
        } finally {
            setLoading(false)
        }
    }

    return { register, handleSubmit: handleSubmit(onSubmit), errors, loading }
}

export default useForgot