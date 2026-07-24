import { useState, useEffect, useCallback, useRef } from 'react'
import storeAuth from '../../context/storeAuth'
import { estudianteService } from '../../services/estudianteService'

const useEstudiantes = () => {
    const [estudiantes, setEstudiantes] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)
    const fileInputRef = useRef(null)
    const { token } = storeAuth()

    const fetchEstudiantes = useCallback(async () => {
        setLoading(true)
        try {
            const data = await estudianteService.list(token)
            setEstudiantes(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [token])

    const handleExcelUpload = async (e) => {
        const archivo = e.target.files?.[0]
        if (!archivo) return
        const formData = new FormData()
        formData.append('tipo', 'estudiante')
        formData.append('file', archivo)
        try {
            setUploading(true)
            const response = await estudianteService.uploadExcel(formData, token)
            alert(`¡Proceso terminado!\nGuardados: ${response?.guardados ?? 0}\nErrores: ${response?.errores?.length ?? 0}`)
            fetchEstudiantes()
        } catch (error) {
            alert(error.response?.data?.msg || 'Error al procesar el archivo Excel')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleEliminar = async (id, nombre, apellido) => {
        if (!window.confirm(`¿Estás seguro de eliminar al estudiante ${nombre} ${apellido}?`)) return
        try {
            await estudianteService.remove(id, token)
            setEstudiantes(prev => prev.filter(e => e._id !== id))
        } catch {
            alert('No se pudo eliminar al estudiante')
        }
    }

    const handleEliminarTodo = async () => {
        if (estudiantes.length === 0) return
        if (!window.confirm(`¿Estás TOTALMENTE seguro de eliminar los ${estudiantes.length} estudiantes?`)) return
        if (!window.confirm('¡ALERTA FINAL! ¿Confirmar borrado total?')) return
        try {
            setDeletingAll(true)
            await Promise.all(estudiantes.map(e => estudianteService.remove(e._id, token)))
            alert('Todos los estudiantes han sido eliminados.')
            setEstudiantes([])
        } catch {
            alert('Ocurrió un error al eliminar algunos estudiantes.')
            fetchEstudiantes()
        } finally {
            setDeletingAll(false)
        }
    }

    useEffect(() => {
        if (token) fetchEstudiantes()
    }, [token, fetchEstudiantes])

    return {
        estudiantes, loading, uploading, deletingAll, fileInputRef,
        handleExcelUpload, handleEliminar, handleEliminarTodo
    }
}

export default useEstudiantes