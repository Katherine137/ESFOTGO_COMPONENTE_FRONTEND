export const PASSWORD_RULE = {
    value: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{12,}$/,
    message: 'Mínimo 12 caracteres, con mayúsculas, minúsculas y números'
}
export const EMAIL_RULE = {
    value: /^[a-z0-9._%+-]+@epn\.edu\.ec$/,
    message: 'Debe ser un correo institucional @epn.edu.ec en minúsculas'
}