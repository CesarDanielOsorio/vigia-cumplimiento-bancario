import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Search, ShieldCheck } from 'lucide-react'
import { api, type AuditResponse } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useRegisterTour } from '../lib/tour'
import { startAuditTour } from '../tours/auditTour'
import PermissionsTable from '../components/admin/PermissionsTable'
import { fmtDate } from '../components/matrix/ui'

// Nombre legible de cada acción registrada (backend/src/services/audit.ts).
const ACTION_LABEL: Record<string, string> = {
  LOGIN_OK: 'Inicio de sesión', LOGIN_FAIL: 'Intento fallido', LOGIN_LOCKED: 'Cuenta bloqueada', LOGOUT: 'Cierre de sesión',
  SYNC_ALL: 'Sincronizar todas las listas', SYNC_LIST: 'Sincronizar lista', VIEW_RECORDS: 'Búsqueda en listas',
  RISK_EVENT_CREATE: 'Evento registrado', RISK_SCREEN: 'Verificación en listas', SENSITIVITY_RUN: 'Prueba de sensibilidad',
  WEIGHTS_PROPOSE: 'Propuesta de pesos', WEIGHTS_APPROVE: 'Versión aprobada', WEIGHTS_REJECT: 'Versión rechazada',
  WEIGHTS_SELF_REVIEW_DENIED: 'Autoaprobación bloqueada',
  INCIDENT_REGISTER: 'Incidencia registrada', INCIDENT_DIAGNOSE: 'Incidencia diagnosticada', INCIDENT_CORRECT: 'Incidencia corregida',
  INCIDENT_REVALIDATE: 'Incidencia revalidada', INCIDENT_RETURN: 'Incidencia devuelta', INCIDENT_SPONSOR: 'Aviso al patrocinador',
  INCIDENT_CLOSE: 'Incidencia cerrada', INCIDENT_SOD_DENIED: 'Segregación de funciones: bloqueado',
  USER_CREATE: 'Usuario creado', USER_UPDATE: 'Usuario modificado', USER_UNLOCK: 'Usuario desbloqueado',
  USER_RESET_PASSWORD: 'Contraseña restablecida', SETTINGS_UPDATE: 'Parámetros modificados',
}

// Acciones que un auditor revisa con lupa: accesos fallidos y controles que se activaron.
const ALERT = new Set(['LOGIN_FAIL', 'LOGIN_LOCKED', 'WEIGHTS_SELF_REVIEW_DENIED', 'INCIDENT_SOD_DENIED'])

export default function AuditLog() {
  const { user } = useAuth()
  const [data, setData] = useState<AuditResponse | null>(null)
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setData(await api.audit(query, action, page)); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la bitácora') }
  }, [query, action, page])
  useEffect(() => { load() }, [load])

  // Busca 300 ms después de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  useRegisterTour(data ? startAuditTour : null)

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint-600">Evidencia · Solo lectura</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Bitácora de auditoría</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
          Todo lo que pasa en el sistema queda aquí con usuario, fecha e IP: accesos, sincronizaciones, cambios de pesos, incidencias y
          cambios de configuración. Nadie la puede editar ni borrar desde la aplicación.
        </p>
      </header>

      <div data-tour="filtros-bitacora" className="mt-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por usuario o detalle…" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15" />
        </div>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-mint-500">
          <option value="">Todas las acciones</option>
          {data?.actions.map(a => <option key={a} value={a}>{ACTION_LABEL[a] ?? a}</option>)}
        </select>
      </div>

      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {!data ? (
        !error && <div className="grid h-64 place-items-center"><Loader2 className="size-7 animate-spin text-mint-500" /></div>
      ) : (
        <section data-tour="tabla-bitacora" className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-navy-900 text-[10px] uppercase tracking-wider text-slate-200">
                <tr>{['Fecha', 'Usuario', 'Acción', 'Detalle', 'IP'].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.logs.map(l => (
                  <tr key={l.id} className={ALERT.has(l.action) ? 'bg-rose-50/50' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(l.createdAt)}</td>
                    <td className="px-3 py-2 font-medium text-navy-900">{l.username ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`font-semibold ${ALERT.has(l.action) ? 'text-rose-700' : 'text-navy-900'}`}>{ACTION_LABEL[l.action] ?? l.action}</span>
                      <span className="block font-mono text-[10px] text-slate-400">{l.action}</span>
                    </td>
                    <td className="max-w-md px-3 py-2 text-slate-600">{l.detail ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-500">{l.ip ?? '—'}</td>
                  </tr>
                ))}
                {data.logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Sin registros con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            <span>{data.total.toLocaleString('en-US')} registro(s)</span>
            <span className="flex items-center gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="rounded-md p-1 hover:bg-slate-100 disabled:opacity-30" aria-label="Anterior"><ChevronLeft className="size-4" /></button>
              Página {page} de {pages}
              <button onClick={() => setPage(p => p + 1)} disabled={page >= pages} className="rounded-md p-1 hover:bg-slate-100 disabled:opacity-30" aria-label="Siguiente"><ChevronRight className="size-4" /></button>
            </span>
          </div>
        </section>
      )}

      <section data-tour="permisos-bitacora" className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900"><ShieldCheck className="size-4 text-mint-600" /> Permisos por rol</h2>
          <p className="mt-0.5 text-xs text-slate-500">Para contrastar la bitácora con lo que cada rol puede hacer.</p>
        </div>
        <PermissionsTable highlight={user?.role} />
      </section>
    </div>
  )
}
