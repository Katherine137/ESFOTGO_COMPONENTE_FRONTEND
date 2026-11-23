import { PASSWORD_RULE } from '../utils/validators'
import { ToastContainer } from 'react-toastify'
import useReset from '../hooks/auth/useReset'

const Reset = () => {
    const { register, handleSubmit, errors, tokenValido } = useReset()

    return (
        <div className="bg-linear-to-b from-blue-950 to-rose-950 flex flex-col items-center justify-center h-screen">
            <ToastContainer />

            <h1 className="text-3xl font-semibold mb-1 text-center text-gray-500">
                Bienvenido nuevamente
            </h1>
            <small className="text-gray-400 block my-2 text-sm">
                Por favor, ingrese los siguientes datos
            </small>
            <div className="object-cover h-55 w-55 border-4 rounded-full border-solid border-black bg-[url('/Dragon_Esfot.png')] bg-cover bg-center"></div>
            <br />

            {tokenValido && (
                <div className="w-full h-[275px] max-w-sm p-8 bg-red-50 rounded-lg shadow-lg">
                    <form className="w-80" onSubmit={handleSubmit}>

                        <div className="mb-1">
                            <label className="mb-2 block text-sm font-semibold">Nueva contraseña</label>
                            <input
                                type="password"
                                placeholder="Ingresa tu nueva contraseña"
                                className="block w-full rounded-md border border-blue-500 py-1 px-1.5 text-neutral-950"
                                {...register("password", { required: "La contraseña es obligatoria", pattern: PASSWORD_RULE })}
                            />
                            {errors.password && (
                                <p className="text-red-900 text-xs mt-1">{errors.password.message}</p>
                            )}

                            <br />

                            <label className="mb-2 block text-sm font-semibold">Confirmar contraseña</label>
                            <input
                                type="password"
                                placeholder="Ingresa de nuevo tu contraseña"
                                className="block w-full rounded-md border border-blue-500 py-1 px-1.5 text-neutral-950"
                                {...register("confirmpassword", { required: "La contraseña es obligatoria", pattern: PASSWORD_RULE })}
                            />
                            {errors.confirmpassword && (
                                <p className="text-red-900 text-xs mt-1">{errors.confirmpassword.message}</p>
                            )}
                        </div>

                        <br />

                        <div className="mb-3">
                            <button
                                type="submit"
                                className="block w-full py-2 text-center bg-red-900 text-white rounded-xl hover:bg-gray-900 duration-300"
                            >
                                Enviar
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default Reset