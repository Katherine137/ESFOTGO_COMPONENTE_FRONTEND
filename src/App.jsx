import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { Home } from './pages/Home'
import Login from './pages/Login'
import { Forgot } from './pages/Forgot'
import { Register } from './pages/Register'
import Reset from './pages/Reset'
import { Map } from './pages/Map'
import Dashboard from './layout/Dashboard'
import Profile from './pages/Profile'
import Event from './pages/Event'
import Chat from './pages/Chat'
import Tutoring from './pages/Tutoring'
import Tutoria from './pages/Tutoria'
import List from './pages/List'
import DashboardHome from './pages/DashboardHome'

import PublicRoute from './routes/PublicRoute'
import ProtectedRoute from './routes/ProtectedRoute'

import EventoList from './components/event/EventoList'
import EventoCardUpdate from './components/event/EventoCardUpdate'
import TutoriaList from './components/Tutoring/TutoriaList'
import TutoriaCardUpdate from './components/Tutoring/TutoriaCardUpdate'
import UbicacionesList from './components/ubicacion/UbicacionesList'
import DocenteList from './components/Teacher/DocenteList'
import EstudianteList from './components/student/EstudianteList'
import RutasList from './components/ruta/RutaList'
import MapCreate from './components/map/Mapcreate'

import storeProfile from './context/storeProfile'
import storeAuth from './context/storeAuth'

function App() {
  const { profile } = storeProfile()
  const { token } = storeAuth()

  useEffect(() => {
    if(token){
      profile()
    }
  }, [token])

  return (  
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute/>}>
          <Route index element={<Home />} />
          <Route path='login' element={<Login />}/>
          <Route path='register' element={<Register/>}/>
          <Route path='forgot/:id' element={<Forgot/>}/>
          <Route path='recuperarpassword/:token' element={<Reset/>}/>
          <Route path='map' element={<Map/>}/>
        </Route>

        <Route path='/dashboard' element={
          <ProtectedRoute>
            <Dashboard/>
          </ProtectedRoute>
        }>
          <Route index element={<DashboardHome/>}/>
          <Route path='profile' element={<Profile/>}/>
          <Route path='event' element={<Event/>}/>
          <Route path='tutoring' element={<Tutoring/>}/>
          <Route path='tutoria' element={<Tutoria/>}/>
          <Route path='actualizarevento/:id' element={<EventoCardUpdate />}/>
          <Route path='actualizartutoria/:id' element={<TutoriaCardUpdate />}/>
          <Route path='mapcreate' element={<MapCreate/>}/>
          <Route path='list' element={<List/>}/>
          <Route path='list/ubicaciones' element={<UbicacionesList/>}/>
          <Route path='list/eventos' element={<EventoList />}/>
          <Route path='list/docentes' element={<DocenteList/>}/>
          <Route path='list/estudiantes' element={<EstudianteList/>}/>
          <Route path='list/tutorias' element={<TutoriaList />}/>
          <Route path='list/rutas' element={<RutasList/>}/>
          
          
        </Route>
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </BrowserRouter>
  )
}

export default App