import usePasswordForm from '../../hooks/profile/usePasswordForm'
import { PASSWORD_RULE } from '../../utils/validators'

const PasswordForm = () => {
    const { register, handleSubmit, errors, getValues } = usePasswordForm()

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="mb-1 block text-base font-semibold text-slate-700">Contraseña actual</label>
                <input type="password" placeholder="Ingresa tu contraseña actual"
                    className="block w-full rounded-xl border border-sky-950 bg-slate-50 py-2.5 px-4 text-neutral-950 outline-none focus:border-blue-950 focus:bg-white transition-all"
                    {...register('passwordactual', { required: 'La contraseña actual es obligatoria' })} />
                {errors.passwordactual && <p className="text-red-600 text-xs mt-1 font-medium">{errors.passwordactual.message}</p>}
            </div>

            <div>
                <label className="mb-1 block text-base font-semibold text-slate-700">Nueva contraseña</label>
                <input type="password" placeholder="Ingresa tu nueva contraseña"
                    className="block w-full rounded-xl border border-sky-950 bg-slate-50 py-2.5 px-4 text-neutral-950 outline-none focus:border-blue-950 focus:bg-white transition-all"
                    {...register('passwordnuevo', { required: 'La contraseña nueva es obligatoria', pattern: PASSWORD_RULE })} />
                {errors.passwordnuevo && <p className="text-red-600 text-xs mt-1 font-medium">{errors.passwordnuevo.message}</p>}
            </div>

            <div>
                <label className="mb-1 block text-base font-semibold text-slate-700">Confirmar nueva contraseña</label>
                <input type="password" placeholder="Repite tu nueva contraseña"
                    className="block w-full rounded-xl border border-sky-950 bg-slate-50 py-2.5 px-4 text-neutral-950 outline-none focus:border-blue-950 focus:bg-white transition-all"
                    {...register('confirmpassword', {
                        required: 'Confirma la nueva contraseña',
                        validate: (v) => v === getValues('passwordnuevo') || 'Las contraseñas no coinciden'
                    })} />
                {errors.confirmpassword && <p className="text-red-600 text-xs mt-1 font-medium">{errors.confirmpassword.message}</p>}
            </div>

            <div className="pt-2">
                <button type="submit"
                    className="w-full py-3 text-center bg-blue-950 text-white font-semibold rounded-xl hover:bg-blue-900 cursor-pointer shadow-md active:scale-[0.98] transition-all duration-200">
                    Actualizar Contraseña
                </button>
            </div>
        </form>
    )
}

export default PasswordForm