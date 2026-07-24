import { Link } from "react-router-dom";
import EventoGrid from "../components/event/EventoGrid";
import useEventos from "../hooks/events/useEventos";
import Logo from "../assets/Logo.png";
import esfot from "../assets/esfot.jpeg"
import esfot21 from "../assets/esfot21.jpeg"

export const Home = () => {
    const { eventos } = useEventos({ mode: 'public' })

    const scrollToMap = () => {
        const mapSection = document.getElementById('map-section');
        if (mapSection) {
            mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const scrollToEvent = () => {
        const contactSection = document.getElementById('event-section');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const scrollToContact = () => {
        const contactSection = document.getElementById('contact-section');
        if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <>
            <header className="fixed top-0 left-0 w-full bg-white shadow-md z-50 h-16 flex justify-between items-center px-4 md:px-6">
                <img className="h-28 w-auto object-contain" src={Logo} alt="logo" />
                <ul className="flex gap-5 justify-center my-4 flex-wrap">
                    <li><a href="#" className='font-bold hover:text-sky-500 hover:underline text-blue-800'>HOGAR</a></li>
                    <li><button onClick={scrollToMap} className='font-bold hover:text-sky-500 hover:underline text-blue-800'>MAPA</button></li>
                    <li><button onClick={scrollToEvent} className='font-bold hover:text-sky-500 hover:underline text-blue-800'>EVENTOS</button></li>
                    <li><button onClick={scrollToContact} className='font-bold hover:text-sky-500 hover:underline text-blue-800'>CONTACTO</button></li>
                </ul>
                <ul className="flex justify-center items-center gap-4 my-4">
                    <li><Link to="/Login" className="bg-red-700 text-white px-6 py-2 rounded-xl shadow-md hover:bg-red-800 hover:scale-105 transition-transform duration-200">Iniciar Sesión</Link></li>
                    <li><Link to="/Register" className="bg-red-700 text-white px-6 py-2 rounded-xl shadow-md hover:bg-red-800 hover:scale-105 transition-transform duration-200">Registrarse</Link></li>
                </ul>
            </header>

            <div className="pt-20">
                <div className="relative w-full max-w-5xl h-[250px] sm:h-[300px] md:h-[380px] lg:h-[480px] rounded-2xl overflow-hidden mx-auto mt-5">
                    <img src={esfot21} alt="Campus Esfot" className="w-full h-full object-cover" />

                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center px-4 text-center">
                        <br />
                        <p className="text-white text-4xl sm:text-4xl md:text-5xl font-extrabold ">Explora el campus de la Esfot</p>
                        <p className="text-white text-2xl sm:text-lg md:text-1xl">"Descubre la Esfot a un clic y recuerda el campus como un experto."</p>
                        <button
                            onClick={scrollToMap}
                            className="bg-red-700 text-white px-6 py-2 rounded-2xl shadow-md hover:bg-red-800 hover:scale-105 transition-transform duration-200"
                        >
                            Comienza ahora
                        </button>
                    </div>
                </div>

                <section id="map-section" className="container mx-auto px-4 my-10">
                    <div className="container mx-auto relative mt-6">
                        <div className='text-red-800 border-2' />
                        <br />
                        <h1 className="text-blue-950 text-3xl relative w-50 text-center mx-auto font-semibold">EXPLORA EL CAMPUS</h1>
                        <p className="text-center text-gray-600 mt-4 text-lg">Descubre todas las ubicaciones importantes de la ESFOT</p>
                    </div>

                    <div className="my-8">
                        <Link to="/map">
                            <div className="relative w-full h-[500px] rounded-2xl overflow-hidden shadow-2xl cursor-pointer hover:shadow-3xl transition-shadow duration-300 group">
                                <img
                                    src={esfot}
                                    alt="Mapa Campus"
                                    className="w-full h-full object-cover blur-sm group-hover:blur-none transition-all duration-300"
                                />

                                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="text-white text-6xl mb-4 animate-bounce">
                                            🗺️
                                        </div>
                                        <h2 className="text-white text-4xl font-bold">Ver Mapa Interactivo</h2>
                                        <p className="text-white text-xl">Haz clic para explorar el campus completo</p>
                                        <div className="flex gap-4 justify-center text-white text-sm mt-6">
                                            <span className="flex items-center gap-2">
                                                <span className="text-2xl">📍</span>
                                                Ubicaciones
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span className="text-2xl">🚍</span>
                                                Rutas
                                            </span>
                                        </div>
                                        <button className="bg-red-700 text-white px-8 py-3 rounded-2xl shadow-lg hover:bg-red-800 hover:scale-110 transition-transform duration-200 mt-4">
                                            Abrir Mapa Completo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                            <div className="text-4xl mb-3 text-center">🏫</div>
                            <h3 className="text-xl font-bold text-blue-950 text-center mb-2">Ubicaciones</h3>
                            <p className="text-gray-600 text-center">Encuentra fácilmente todas las ubicaciones del campus</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                            <div className="text-4xl mb-3 text-center">📍</div>
                            <h3 className="text-xl font-bold text-blue-950 text-center mb-2">Tu Ubicación</h3>
                            <p className="text-gray-600 text-center">Navega desde tu posición actual hacia cualquier destino</p>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
                            <div className="text-4xl mb-3 text-center">🚍</div>
                            <h3 className="text-xl font-bold text-blue-950 text-center mb-2">Polibus</h3>
                            <p className="text-gray-600 text-center">Visualiza las rutas del Polibus</p>
                        </div>
                    </div>
                </section>

                <section className="container mx-auto px-4">
                    <div className="container mx-auto relative mt-6">
                        <div className='text-red-800 border-2' />
                        <br />
                        <h1 className="text-blue-950 text-3xl relative w-50 text-center mx-auto font-semibold">SOBRE NOSOTROS</h1>
                    </div>
                    <div className="my-5 flex flex-col items-center sm:flex-row sm:justify-around sm:items-center">
                        <div className="font-serif text-[20px]">
                            <p>ESFOTgo es una aplicación de geolocalización creada por y para estudiantes de la ESFOT. <br />
                                Que brinda ayuda en la ubicación de aulas, laboratorios, oficinas y otros puntos clave del campus, <br />
                                facilitando la movilidad con información útil y actualizada.</p>
                        </div>
                        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ7-H9Cj8K_FHrmlPd1p99NGxIGnvOg09zRnw&s" alt="esfot_dragon" className="w-[200px] h-[200px]" />
                    </div>
                </section>

                <section id="event-section">
                    <div className="container mx-auto relative mt-8 px-4">
                        <div className='text-red-800 border-2' />
                        <br />
                        <h1 className="text-blue-950 text-3xl text-center mx-auto font-semibold">EVENTOS</h1>
                        <br />
                    </div>
                    <EventoGrid eventos={eventos} emptyText="No hay eventos disponibles" />
                </section>

                <footer className="bg-gray-900 text-white mt-20" id="contact-section">
                    <div className="max-w-7xl mx-auto px-4 py-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-20 mb-8">

                            <div>
                                <h2 className="text-2xl font-bold mb-4">
                                    <span className="text-red-700">ESFOT</span>go
                                </h2>
                                <p className="text-gray-400 mb-4">
                                    Explora el campus de la ESFOT de manera virtual. <br />Descubre cada laboratorio y espacio de nuestra institución.
                                </p>
                                <div className="flex gap-4">
                                    <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                    </a>
                                    <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                                        </svg>
                                    </a>
                                    <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-4 text-red-700">Contacto</h3>
                                <ul className="space-y-3 text-gray-400">
                                    <li className="flex items-start gap-2">
                                        <span>📍</span>
                                        <span>Escuela de Formación de Tecnólogos<br />Quito, Ecuador</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span>📧</span>
                                        <span>esfotgo@gmail.com</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span>📞</span>
                                        <span>+593 998 469 9547</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="border-t border-gray-800 pt-6 text-center">
                            <p className="text-gray-500 text-sm">
                                &copy; 2025 ESFOTgo. Todos los derechos reservados. | Desarrollado por estudiantes para la comunidad ESFOT
                            </p>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    )
}