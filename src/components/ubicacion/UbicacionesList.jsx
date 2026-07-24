import useUbicaciones from '../../hooks/ubicacion/useUbicaciones'

const UbicacionesList = () => {
    const { 
        ubicaciones, 
        loading, 
        error, 
        categoriaSeleccionada, 
        setCategoriaSeleccionada 
    } = useUbicaciones()

    const categorias = [
        { id: null, label: 'Todos' },
        { id: 'Academico', label: 'Académico' },
        { id: 'Biblioteca', label: 'Biblioteca' },
        { id: 'Servicios', label: 'Servicios' },
        { id: 'Deportes', label: 'Deportes' },
        { id: 'Estacionamiento', label: 'Estacionamiento' },
        { id: 'Entrada', label: 'Entrada' },
        { id: 'Otro', label: 'Otro' }
    ]

    if (loading) return (
        <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Cargando ubicaciones...</p>
        </div>
    )

    if (error) return (
        <div className="p-4 text-sm text-red-800 rounded-lg bg-red-50 mx-4" role="alert">
            <span className="font-medium">Error: {error}</span>
        </div>
    )

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold text-gray-700 mb-4">Lista de Ubicaciones</h2>
            
            <div className="flex flex-wrap gap-2 mb-6">
                {categorias.map((cat) => (
                    <button
                        key={cat.id ?? 'todas'}
                        onClick={() => setCategoriaSeleccionada(cat.id)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                            categoriaSeleccionada === cat.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {ubicaciones.length === 0 ? (
                <div className="p-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 mx-4" role="alert">
                    <span className="font-medium">No existen registros de ubicaciones</span>
                </div>
            ) : (
                <div className="w-full overflow-x-auto rounded-lg shadow-lg">
                    <table className="w-full table-auto bg-white">
                        <thead className="bg-gray-800 text-slate-400">
                            <tr>
                                {['N°', 'Nombre', 'Descripción', 'Categoría'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {ubicaciones.map((ubicacion, index) => (
                                <tr className="hover:bg-gray-50 text-gray-700" key={ubicacion._id}>
                                    <td className="px-4 py-3">{index + 1}</td>
                                    <td className="px-4 py-3 font-medium">{ubicacion.nombre}</td>
                                    <td className="px-4 py-3">{ubicacion.descripcion || 'Sin descripción'}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-blue-100 text-blue-800">
                                            {ubicacion.categoria}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default UbicacionesList