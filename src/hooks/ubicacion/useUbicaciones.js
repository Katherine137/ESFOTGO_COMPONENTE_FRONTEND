import { useState, useEffect, useCallback } from 'react'
import storeAuth from '../../context/storeAuth'
import { ubicacionesService } from '../../services/ubicacionesService'

const useUbicaciones = () => {
    const [ubicaciones, setUbicaciones] = useState([])
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const { token } = storeAuth()

    const fetchUbicaciones = useCallback(async (categoria = null) => {
        if (!token) return
        setLoading(true)
        setError(null)
        try {
            let data;
            if (categoria) {
                data = await ubicacionesService.listByCategory(categoria, token)
            } else {
                data = await ubicacionesService.list(token)
            }
            setUbicaciones(data)
        } catch (err) {
            console.error('Error al cargar ubicaciones:', err)
            setError(err.response?.data?.msg || 'No se pudieron cargar las ubicaciones')
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        fetchUbicaciones(categoriaSeleccionada)
    }, [fetchUbicaciones, categoriaSeleccionada])

    return { 
        ubicaciones, 
        loading, 
        error, 
        fetchUbicaciones, 
        categoriaSeleccionada, 
        setCategoriaSeleccionada 
    }
}

export default useUbicaciones