import { Navigate, useLocation } from "react-router-dom"
import storeAuth from "../context/storeAuth"

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { token, rol} = storeAuth()
    const location = useLocation()

    if (!token) return <Navigate to="/login" state={{ from: location}} replace />

    if (allowedRoles.length > 0 && !allowedRoles.includes(rol)) {
        return <Navigate to="/dashboard" replace />
    }
    
    return children
}

export default ProtectedRoute