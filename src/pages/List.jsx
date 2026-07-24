import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import storeAuth from "../context/storeAuth"
import storeProfile from "../context/storeProfile"

const List = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const urlActual = location.pathname
    
    const { logout, token, rol } = storeAuth()
    const { user: profileUser, profile } = storeProfile()
    
    const user = profileUser 
    
    const [sidebarOpen, setSidebarOpen] = useState(true)

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
    
    return(
        <>
            <br/>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4 px-4 sm:px-6 lg:px-8">
                <h1 className='font-black text-4xl text-blue-950'>Listados</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-8 px-4 sm:px-6 lg:px-8">
                {(rol === 'docente') && (
                    <Link 
                        to="/dashboard/list/tutorias"
                        className="bg-white border-2 border-blue-500 p-6 rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 transition-all"
                    >
                        <div className="text-center">
                            <div className="text-5xl mb-4">🦉</div>
                            <h2 className="text-xl font-bold text-blue-900">Tutorias</h2>
                            <p className="text-gray-600 mt-2">Ver listado de tutorias</p>
                        </div>
                    </Link>
                )}
                <Link 
                    to="/dashboard/list/eventos"
                    className="bg-white border-2 border-green-500 p-6 rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 transition-all"
                >
                    <div className="text-center">
                        <div className="text-5xl mb-4">📅</div>
                        <h2 className="text-xl font-bold text-green-900">Eventos</h2>
                        <p className="text-gray-600 mt-2">Ver listado de eventos</p>
                    </div>
                </Link>
                {(rol === 'admin') && (
                    <Link 
                        to="/dashboard/list/docentes"
                        className="bg-white border-2 border-purple-500 p-6 rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 transition-all"
                    >
                        <div className="text-center">
                            <div className="text-5xl mb-4">📅</div>
                            <h2 className="text-xl font-bold text-purple-900">Docentes</h2>
                            <p className="text-gray-600 mt-2">Ver listado de docentes</p>
                        </div>
                    </Link>
                )}
                {(rol === 'admin') && (
                    <Link 
                        to="/dashboard/list/ubicaciones"
                        className="bg-white border-2 border-purple-500 p-6 rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 transition-all"
                    >
                        <div className="text-center">
                            <div className="text-5xl mb-4">🏫</div>
                            <h2 className="text-xl font-bold text-purple-900">Ubicaciones</h2>
                            <p className="text-gray-600 mt-2">Ver listado de ubicaciones</p>
                        </div>
                    </Link>
                )}
                {(rol === 'admin') && (
                    <Link 
                        to="/dashboard/list/estudiantes"
                        className="bg-white border-2 border-purple-500 p-6 rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 transition-all block"
                    >
                        <div className="text-center">
                            <div className="text-5xl mb-4">🧑‍🎓</div>
                            
                            <h2 className="text-xl font-bold text-purple-900">Estudiantes</h2>
                            
                            <p className="text-gray-600 mt-2">Ver listado de estudiantes</p>
                        </div>
                    </Link>
                )}
                {(rol === 'admin') && (
                    <Link 
                        to="/dashboard/list/rutas"
                        className="bg-white border-2 border-blue-500 p-6 rounded-lg shadow-lg hover:bg-blue-50 hover:scale-105 transition-all block"
                    >
                        <div className="text-center">
                            <div className="text-5xl mb-4">🗺️</div>
                            
                            <h2 className="text-xl font-bold text-blue-900">Rutas</h2>
                            
                            <p className="text-gray-600 mt-2">Ver listado de rutas</p>
                        </div>
                    </Link>
                )}
            </div>
        </>
    )
}

export default List