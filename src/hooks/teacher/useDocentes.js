import { useState, useEffect, useCallback, useRef } from 'react'
import storeAuth from '../../context/storeAuth'
import { docenteService } from '../../services/docenteService'

const useDocentes = () => {
    const [docentes, setDocentes] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)
    const [actualizandoId, setActualizandoId] = useState(null)
    const fileInputRef = useRef(null)
    const { token } = storeAuth()

    const fetchDocentes = useCallback(async () => {
        setLoading(true)
        try {
            const data = await docenteService.list(token)
            setDocentes(data)
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
        formData.append('tipo', 'docente')
        formData.append('file', archivo)
        try {
            setUploading(true)
            const response = await docenteService.uploadExcel(formData, token)
            alert(`¡Proceso terminado!\nGuardados: ${response?.guardados ?? 0}\nErrores: ${response?.errores?.length ?? 0}`)
            fetchDocentes()
        } catch (error) {
            alert(error.response?.data?.msg || 'Error al procesar el archivo Excel')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleEliminar = async (id, nombre, apellido) => {
        if (!window.confirm(`¿Estás seguro de eliminar al docente ${nombre} ${apellido}?`)) return
        try {
            await docenteService.remove(id, token)
            setDocentes(prev => prev.filter(d => d._id !== id))
        } catch {
            alert('No se pudo eliminar al docente')
        }
    }

    const handleEliminarTodo = async () => {
        if (docentes.length === 0) return
        if (!window.confirm(`¿Estás TOTALMENTE seguro de eliminar los ${docentes.length} docentes?`)) return
        if (!window.confirm('¡ALERTA FINAL! ¿Confirmar borrado total?')) return
        try {
            setDeletingAll(true)
            await Promise.all(docentes.map(d => docenteService.remove(d._id, token)))
            alert('Todos los docentes han sido eliminados.')
            setDocentes([])
        } catch {
            alert('Ocurrió un error al eliminar algunos docentes.')
            fetchDocentes()
        } finally {
            setDeletingAll(false)
        }
    }

    useEffect(() => {
        if (token) fetchDocentes()
    }, [token, fetchDocentes])

    return {
        docentes, loading, uploading, deletingAll, actualizandoId, fileInputRef,
        handleExcelUpload, handleEliminar, handleEliminarTodo
    }
}

export default useDocentes