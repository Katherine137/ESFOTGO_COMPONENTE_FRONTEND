import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import storeAuth from "../context/storeAuth"
import storeProfile from "../context/storeProfile"
import Chat from "../pages/Chat"

const Dashboard = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const urlActual = location.pathname
    
    const { logout, token, rol } = storeAuth()
    const { user: profileUser, profile } = storeProfile()
    
    const user = profileUser 
    
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const visualizarlista = rol === 'admin' || rol === 'docente'

    useEffect(() => {
        if (token && rol) {
            profile()
        }
    }, [token, rol])
    
    const handleLogout = () => {
        if (typeof logout === 'function') {
            logout()
            navigate('/login', { replace: true })
        } else {
            console.error("Error: 'logout' no es una función. Revisa tu Context.")
        }
    }
    return (
        <div className="min-h-screen flex flex-col">
            <div className="fixed top-0 left-0 w-full bg-white shadow-md z-50 h-16 flex justify-between items-center px-4 md:px-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        aria-label="Toggle sidebar"
                    >
                        <svg
                            className="w-6 h-6 text-gray-700"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            {sidebarOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            )}
                        </svg>
                    </button>
                    
                    <img className="h-28 w-auto object-contain" src="/dragon_logo_2.png" alt="ESFOTgo" />
                </div>

                <div className='flex justify-center items-center gap-4 text-md font-semibold text-black'>
                    <span className="hidden md:inline">
                        {user?.nombre ? `Usuario - ${user.nombre}` : 'Cargando...'}
                    </span>
                    <img 
                        className="h-12 w-12 object-cover rounded-full border-black border-2" 
                        src={user?.imagen || user?.photo || "/Buho_1.png"} 
                        alt="usuario" 
                    />
                </div>

                <div className="flex items-center gap-5 w-fit">
                    <Link 
                        to='/dashboard/profile' 
                        className="bg-indigo-600 text-white px-4 md:px-4 py-1 rounded-4xl shadow-md hover:bg-indigo-700 hover:scale-105 transition-transform duration-200"
                    >
                        Mi Perfil
                    </Link>
                        
                    <button
                        onClick={handleLogout}
                        className="bg-red-700 text-white px-4 md:px-6 py-2 rounded-4xl shadow-md hover:bg-red-800 hover:scale-105 transition-transform duration-200"
                    >
                        Salir
                    </button>
                </div>
            </div>
            
            <div className="flex mt-16 flex-1">
                <div
                    className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
                        sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
                    }`}
                >
                    <div className="px-5 py-4 min-w-64">
                        <img
                            className="h-[200px] w-[200px] object-cover mx-auto rounded-full border-black border-2 mb-4"
                            src={user?.imagen || user?.photo || "/Buho_1.png"}
                            alt="usuario"
                        />
        
                        <p className='text-slate-400 text-center my-4 text-sm'>
                            <span className='bg-green-600 w-3 h-3 inline-block rounded-full'></span> 
                            {' '}
                            {user?.nombre ? `Bienvenido - ${user.nombre}` : 'Cargando...'}
                        </p>

                        <p className='text-slate-400 text-center my-4 text-sm'>
                            Rol - {String(rol?.nombre ?? rol?.name ?? rol ?? 'N/A')}
                        </p>

                        <div className="flex flex-col gap-3 mt-6">
                            <Link
                                to='/dashboard'
                                className={`w-full text-center py-3 rounded-lg border-2 shadow-lg transition-all ${
                                    urlActual === '/dashboard'
                                        ? 'bg-blue-400 text-blue-950 border-blue-500 font-semibold'
                                        : 'border-white hover:bg-blue-400 text-gray-600'
                                }`}
                            >
                                Dashboard
                            </Link>
                            
                            <Link
                                to='/dashboard/event'
                                className={`w-full text-center py-3 rounded-lg border-2 shadow-lg transition-all ${
                                    urlActual.includes('/event')
                                        ? 'bg-blue-400 text-blue-950 border-blue-500 font-semibold'
                                        : 'border-white hover:bg-blue-400 text-gray-600'
                                }`}
                            >
                                Eventos
                            </Link>

                            {(rol === 'user') && (
                            <Link
                                to='/dashboard/tutoria'
                                className={`w-full text-center py-3 rounded-lg border-2 shadow-lg transition-all ${
                                    urlActual.includes('/tutoria')
                                        ? 'bg-blue-400 text-blue-950 border-blue-500 font-semibold'
                                        : 'border-white hover:bg-blue-400 text-gray-600'
                                }`}
                            >
                                Tutoria
                            </Link>
                            )}

                            {(rol === 'admin') && (
                                <Link
                                    to='/dashboard/mapcreate'
                                    className={`w-full text-center py-3 rounded-lg border-2 shadow-lg transition-all ${
                                        urlActual.includes('/mapcreate')
                                            ? 'bg-blue-400 text-blue-950 border-blue-500 font-semibold'
                                            : 'border-white hover:bg-blue-400 text-gray-600'
                                    }`}
                                >
                                    Mapa
                                </Link>
                            )}

                            {(rol === 'docente') && (
                                <Link
                                    to='/dashboard/tutoring'
                                    className={`w-full text-center py-3 rounded-lg border-2 shadow-lg transition-all ${
                                        urlActual.includes('/tutoring')
                                            ? 'bg-blue-400 text-blue-950 border-blue-500 font-semibold'
                                            : 'border-white hover:bg-blue-400 text-gray-600'
                                    }`}
                                >
                                    Tutorías
                                </Link>
                            )}
                            {visualizarlista && (
                                <Link
                                    to='/dashboard/list'
                                    className={`w-full text-center py-3 rounded-lg border-2 shadow-lg transition-all ${
                                        urlActual.includes('/list')
                                            ? 'bg-blue-400 text-blue-950 border-blue-500 font-semibold'
                                            : 'border-white hover:bg-blue-400 text-gray-600'
                                    }`}
                                >
                                    Listas
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden bg-gray-50">
                    <Outlet />
                </div>
            </div>

            <Chat />

            <div className="bg-gray-900 text-white mt-auto">
                <div className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-800 pt-6 text-center">
                    <p className="text-gray-500 text-sm">
                        &copy; 2026 ESFOTgo. Todos los derechos reservados. | Desarrollado por estudiantes para la comunidad ESFOT
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Dashboard