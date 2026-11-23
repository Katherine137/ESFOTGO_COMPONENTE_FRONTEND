import { MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { Link } from 'react-router-dom'
import { EMAIL_RULE } from '../utils/validators'
import { ToastContainer } from 'react-toastify'
import useLogin from '../hooks/auth/useLogin'
import Dragon from '../assets/dragon.png'
import Fondo  from '../assets/fondo.png'

const Login = () => {
    const { register, handleSubmit, errors, selectedRol, setSelectedRol, showPassword, setShowPassword } = useLogin()

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${Fondo})` }}>

            <ToastContainer />

            <div className="hidden md:flex flex-1 items-center justify-center relative overflow-visible">
                <img src={Dragon} alt="dragon"
                    className="shrink-0 object-contain flame-animation w-[320px] md:w-[450px] lg:w-[600px] xl:w-[700px]" />
            </div>

            <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 bg-white rounded-lg shadow-lg">

                    <h1 className="text-2xl sm:text-3xl font-semibold text-center text-slate-600">Bienvenido(a)</h1>
                    <p className="text-blue-400 text-center my-3 text-sm sm:text-base">Por favor ingrese sus credenciales</p>

                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Tipo de Usuario</label>
                            <select value={selectedRol} onChange={(e) => setSelectedRol(e.target.value)}
                                className="w-full border border-blue-500 rounded-md px-2 py-2 text-black">
                                <option value="user">Estudiante</option>
                                <option value="docente">Docente</option>
                                <option value="admin">Administrador</option>
                            </select>
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
                            <label className="block text-sm font-semibold mb-1">Contraseña</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} placeholder="********"
                                    className="w-full border border-blue-500 rounded-md px-2 py-2 pr-10 text-black"
                                    {...register('password', {
                                        required: 'La contraseña es obligatoria',
                                    })} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-gray-600">
                                    {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-600 text-xs mt-1">{errors.password.message}</p>}
                        </div>

                        <button type="submit"
                            className="w-full bg-gray-600 text-white py-2 rounded-xl hover:bg-gray-900 transition">
                            Iniciar sesión
                        </button>
                    </form>

                    <div className="flex items-center my-4">
                        <div className="flex-1 border-t"></div>
                        <span className="px-2 text-xs text-gray-400">o</span>
                        <div className="flex-1 border-t"></div>
                    </div>

                    <div className="flex justify-between text-sm">
                        <Link to="/forgot/id" className="hover:text-blue-800">¿Olvidaste contraseña?</Link>
                        <Link to="/">Hogar</Link>
                    </div>

                    <Link to="/Register"
                        className="block mt-4 text-center bg-red-900 text-white py-2 rounded-xl hover:bg-gray-900 transition">
                        Registrarse
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default Login