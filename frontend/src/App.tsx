import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './lib/auth'
import type { Permission } from './lib/api'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import InternationalLists from './pages/InternationalLists'
import ListRecords from './pages/ListRecords'
import RiskMatrix from './pages/RiskMatrix'
import NewRiskEvent from './pages/NewRiskEvent'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'

export default function App() {
  const { user, loading, can } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-950">
        <Loader2 className="size-8 animate-spin text-mint-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Las pantallas restringidas tampoco se abren escribiendo la URL (y el backend igual rechaza los datos).
  const only = (p: Permission, page: ReactNode) => (can(p) ? page : <Navigate to="/listas-internacionales" replace />)

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/listas-internacionales" element={<InternationalLists />} />
        <Route path="/listas-internacionales/:key" element={<ListRecords />} />
        <Route path="/matriz" element={<RiskMatrix />} />
        <Route path="/matriz/nuevo" element={only('events.create', <NewRiskEvent />)} />
        <Route path="/seguimiento" element={<Incidents />} />
        <Route path="/seguimiento/:code" element={<IncidentDetail />} />
        <Route path="/bitacora" element={only('audit.view', <AuditLog />)} />
        <Route path="/configuracion" element={only('system.manage', <Settings />)} />
        <Route path="/casos/*" element={<Navigate to="/seguimiento" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/listas-internacionales" replace />} />
    </Routes>
  )
}
