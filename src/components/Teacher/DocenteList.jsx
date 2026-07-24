import { useState } from 'react'
import { MdDeleteForever, MdUploadFile } from 'react-icons/md'
import useDocentes from '../../hooks/teacher/useDocentes'

const HEADERS = ['N°', 'Nombre', 'Apellido', 'Celular', 'Email', 'Oficina', 'Horarios', 'Información', 'Acciones']

const DocenteList = () => {
    const {
        docentes, loading, uploading, deletingAll, actualizandoId, fileInputRef,
        handleExcelUpload, handleEliminar, handleEliminarTodo
    } = useDocentes()

    const [busqueda, setBusqueda] = useState('')

    // Filtrar docentes por nombre o apellido
    const docentesFiltrados = docentes.filter(doc => {
        const textoBusqueda = busqueda.toLowerCase()
        const nombre = (doc.nombre || '').toLowerCase()
        const apellido = (doc.apellido || '').toLowerCase()
        return nombre.includes(textoBusqueda) || apellido.includes(textoBusqueda)
    })

    if (loading) return (
        <div className="flex items-center justify-center h-screen"><p>Cargando...</p></div>
    )

    return (
        <div className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-bold text-gray-700">Lista de Docentes</h2>

                <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2">
                    <input type="file" accept=".xlsx, .xls" ref={fileInputRef}
                        onChange={handleExcelUpload} className="hidden" />

                    <button onClick={() => fileInputRef.current.click()}
                        disabled={uploading || deletingAll}
                        className="flex items-center justify-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <MdUploadFile className="text-lg shrink-0" />
                        {uploading ? 'Procesando...' : 'Subir Excel'}
                    </button>

                    <button onClick={handleEliminarTodo}
                        disabled={uploading || deletingAll || docentes.length === 0}
                        className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-medium shadow hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <MdDeleteForever className="text-lg shrink-0" />
                        {deletingAll ? 'Eliminando...' : 'Eliminar Todo'}
                    </button>
                </div>
            </div>

            {/* Barra de Búsqueda */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Buscar por nombre o apellido..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full sm:w-80 px-4 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
            </div>

            {docentes.length === 0 ? (
                <div className="p-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                    No existen registros de docentes
                </div>
            ) : docentesFiltrados.length === 0 ? (
                <div className="p-4 text-sm text-yellow-800 rounded-lg bg-yellow-50" role="alert">
                    No se encontraron docentes que coincidan con la búsqueda
                </div>
            ) : (
                <div className="w-full overflow-x-auto rounded-lg shadow-lg">
                    <table className="min-w-full bg-white table-auto text-xs">
                        <thead className="bg-gray-800 text-slate-400">
                            <tr>
                                {HEADERS.map(h => (
                                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {docentesFiltrados.map((docente, index) => {
                                const guardando = actualizandoId === docente._id
                                return (
                                    <tr className="hover:bg-gray-50 text-gray-700" key={docente._id}>
                                        <td className="px-3 py-3 whitespace-nowrap">{index + 1}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">{docente.nombre}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">{docente.apellido}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {docente.celular || docente.telefono || docente.phone || 'N/A'}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">{docente.email}</td>
                                        <td className="px-3 py-3 whitespace-nowrap">{docente.Oficina?.numero || 'N/A'}</td>
                                        <td className="px-3 py-3">
                                            {docente.horariosDisponibles?.filter(h => h.disponible).map((h, idx) => (
                                                <div key={idx} className="whitespace-nowrap">{h.dia}: {h.horaInicio}–{h.horaFin}</div>
                                            )) || 'N/A'}
                                        </td>
                                        <td className="px-3 py-3 max-w-40">
                                            <p className="truncate" title={docente.informacion || 'N/A'}>{docente.informacion || 'N/A'}</p>
                                        </td>
                                        <td className="px-3 py-3">
                                            <button onClick={() => handleEliminar(docente._id, docente.nombre, docente.apellido)}
                                                disabled={deletingAll || guardando}
                                                className="text-red-600 hover:text-red-800 text-xl disabled:opacity-50">
                                                <MdDeleteForever />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default DocenteList