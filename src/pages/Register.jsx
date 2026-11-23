import { MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { EMAIL_RULE, PASSWORD_RULE } from '../utils/validators'
import useRegister from '../hooks/auth/useRegister'
import Dragon from '../assets/dragon.png'
import Fondo  from '../assets/fondo.png'

export const Register = () => {
    const { register, handleSubmit, errors, showPassword, setShowPassword } = useRegister()

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${Fondo})` }}>

            <ToastContainer />

            <div className="hidden md:flex flex-1 items-center justify-center overflow-visible">
                <img src={Dragon} alt="dragon"
                    className="shrink-0 object-contain flame-animation w-[320px] md:w-[450px] lg:w-[600px] xl:w-[700px]" />
            </div>

            <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-sm sm:max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">

                    <h1 className="text-2xl sm:text-3xl font-semibold text-center text-slate-600">Crear Cuenta</h1>
                    <p className="text-blue-400 text-center my-3 text-sm sm:text-base">Ingresa tus datos para registrarte</p>

                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Tipo de Usuario</label>
                            <select {...register('rol', { required: 'El rol es obligatorio' })}
                                className="w-full border border-blue-500 rounded-md px-2 py-2 text-black">
                                <option value="user">Estudiante</option>
                                <option value="docente">Docente</option>
                            </select>
                            {errors.rol && <p className="text-red-600 text-xs mt-1">{errors.rol.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Correo electrónico</label>
                            <input type="email" placeholder="Ingresa tu correo"
                                className="w-full border border-blue-500 rounded-md px-2 py-2 text-black"
                                {...register('email', {
                                    required: 'El correo es obligatorio',
                                    pattern: EMAIL_RULE
                                })} />
                            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Nombre</label>
                            <input type="text" placeholder="Ingresa tu nombre"
                                className="w-full border border-blue-500 rounded-md px-2 py-2 text-black"
                                {...register('nombre', {
                                    required: 'El nombre es obligatorio',
                                    pattern: { value: /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, message: 'Solo se permiten letras' },
                                    validate: (v) => v.trim() !== '' || 'El nombre no puede estar vacío'
                                })} />
                            {errors.nombre && <p className="text-red-600 text-xs mt-1">{errors.nombre.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Apellido</label>
                            <input type="text" placeholder="Ingresa tu apellido"
                                className="w-full border border-blue-500 rounded-md px-2 py-2 text-black"
                                {...register('apellido', {
                                    required: 'El apellido es obligatorio',
                                    pattern: { value: /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, message: 'Solo se permiten letras' },
                                    validate: (v) => v.trim() !== '' || 'El apellido no puede estar vacío'
                                })} />
                            {errors.apellido && <p className="text-red-600 text-xs mt-1">{errors.apellido.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Teléfono</label>
                            <input type="text" placeholder="Ingresa tu teléfono"
                                className="w-full border border-blue-500 rounded-md px-2 py-2 text-black"
                                {...register('telefono', {
                                    required: 'El teléfono es obligatorio',
                                    pattern: { value: /^[0-9]{10}$/, message: 'Solo se permiten 10 números' }
                                })} />
                            {errors.telefono && <p className="text-red-600 text-xs mt-1">{errors.telefono.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1">Contraseña</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} placeholder="Ingresa tu contraseña"
                                    className="w-full border border-blue-500 rounded-md px-2 py-2 pr-10 text-black"
                                    {...register('password', {
                                        required: 'La contraseña es obligatoria',
                                        pattern: PASSWORD_RULE
                                    })} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-gray-600">
                                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
                        </div>

                        <button type="submit"
                            className="w-full bg-red-900 text-white py-2 rounded-xl hover:bg-gray-900 transition">
                            Registrarse
                        </button>
                    </form>

                    <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm">
                        <p>¿Ya tienes cuenta?</p>
                        <Link to="/Login"
                            className="w-full sm:w-auto text-center bg-gray-500 text-white py-2 px-4 rounded-xl hover:bg-gray-900 transition">
                            Iniciar sesión
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}