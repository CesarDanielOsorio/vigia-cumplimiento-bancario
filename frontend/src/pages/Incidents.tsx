import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, CircleAlert, ClipboardList, Clock, GitFork, Grid3x3, Loader2, Plus, TriangleAlert, X,
} from 'lucide-react'
import { api, type FactorKey, type IncidentStatus, type IncidentsResponse, type Methodology } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL, TEAM_ROLES, whoCan } from '../lib/roles'
import { useRegisterTour } from '../lib/tour'
import { startIncidentsTour } from '../tours/incidentsTour'
import { CAUSE_LABEL, STATUS_STYLE, isoDay } from '../components/incidents/incidentUi'
import { FLOW, RACI, RACI_LEGEND, RACI_RULES, RACI_STYLE, countA } from '../components/incidents/raci'

const TABS = [
  { key: 'registro', label: 'Registro de incidencias', icon: ClipboardList },
  { key: 'flujo', label: 'Flujo del proceso', icon: GitFork },
  { key: 'raci', label: 'Matriz RACI', icon: Grid3x3 },
] as const
type Tab = (typeof TABS)[number]['key']

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15'

export default function Incidents() {
  const { can, user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find(t => t.key === params.get('tab'))?.key ?? 'registro'
  const [data, setData] = useState<IncidentsResponse | null>(null)
  const [methodology, setMethodology] = useState<Methodology | null>(null)
  const [error, setError] = useState('')

  // Formulario de registro; ?evento=EV-005 lo abre con el evento elegido (desde el tablero de la matriz).
  const preset = params.get('evento')
  const [form, setForm] = useState<{ open: boolean; eventCode: string; factor: FactorKey | ''; description: string }>({
    open: !!preset, eventCode: preset ?? '', factor: '', description: '',
  })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([api.incidents(), api.methodology()])
      setData(d)
      setMethodology(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el seguimiento')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const goTab = useCallback((t: Tab) => setParams({ tab: t }, { replace: true }), [setParams])
  const tourFn = useCallback(() => startIncidentsTour({ goTab }), [goTab])
  useRegisterTour(data ? tourFn : null)

  const canRegister = can('incidents.register')

  function openForm(eventCode = '', factor: FactorKey | '' = '') {
    setForm({ open: true, eventCode, factor, description: '' })
    setFormError('')
    goTab('registro')
  }

  async function register() {
    setBusy(true); setFormError('')
    try {
      const r = await api.registerIncident({ eventCode: form.eventCode, factor: form.factor || null, description: form.description })
      navigate(`/seguimiento/${r.code}`)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo registrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint-600">Cumplimiento · Gestión de datos incorrectos</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Seguimiento de incidencias</h1>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
            Qué pasa cuando un dato de la matriz está mal: quién lo detecta, quién lo corrige, quién valida que el score se reproduce y quién
            aprueba el cierre, según la matriz RACI del equipo. Todo cambio deja rastro.
          </p>
        </div>
        {canRegister && (
          <button
            data-tour="registrar-incidencia"
            onClick={() => openForm()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-mint-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-navy-950 shadow-lg shadow-mint-500/25 hover:brightness-105"
          >
            <Plus className="size-4" /> Registrar incidencia
          </button>
        )}
      </header>

      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {!data || !methodology ? (
        !error && <div className="grid h-64 place-items-center"><Loader2 className="size-7 animate-spin text-mint-500" /></div>
      ) : (
        <>
          <section data-tour="estados-inc" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(Object.keys(STATUS_STYLE) as IncidentStatus[]).map(s => (
              <div key={s} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${STATUS_STYLE[s].dot}`} />
                  <span className="text-[11px] font-semibold text-slate-600">{STATUS_STYLE[s].label}</span>
                </div>
                <p className="mt-1 text-2xl font-extrabold text-navy-900">{data.stats.byStatus[s]}</p>
              </div>
            ))}
          </section>

          {data.stats.overdue > 0 && (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
              <Clock className="size-4" /> {data.stats.overdue} incidencia(s) llevan más de {data.slaDays} días abiertas (plazo definido en Configuración).
            </p>
          )}

          <nav data-tour="pestanas-inc" className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => goTab(key)}
                className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  tab === key ? 'border-mint-500 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-900'
                }`}
              >
                <Icon className={`size-4 ${tab === key ? 'text-mint-600' : ''}`} /> {label}
              </button>
            ))}
          </nav>

          {tab === 'registro' && (
            <div className="mt-5 space-y-5">
              {/* Detección automática: la matriz marca los datos faltantes */}
              {data.missing.length > 0 && (
                <section data-tour="deteccion" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <CircleAlert className="size-4" /> La matriz detectó datos faltantes
                  </h2>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Estos eventos usan el puntaje conservador de {methodology.missingScore}. No se descartan: se registran como incidencia para completar el dato.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {data.missing.map(m => (
                      <li key={m.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-bold text-navy-900">{m.code}</span>{' '}
                          <span className="text-slate-600">sin dato en {m.factors.map(f => f.label).join(' y ')}</span>
                        </span>
                        {m.openIncident ? (
                          <Link to={`/seguimiento/${m.openIncident}`} className="text-xs font-medium text-mint-700 hover:underline">
                            Ver {m.openIncident}
                          </Link>
                        ) : canRegister ? (
                          <button onClick={() => openForm(m.code, m.factors[0].key)} className="text-xs font-semibold text-amber-800 hover:underline">
                            Registrar incidencia
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">Sin incidencia registrada</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {form.open && canRegister && (
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-navy-900">Pasos 1 y 2 · Detectar y registrar</h2>
                      <p className="mt-0.5 text-xs text-slate-500">Documenta el evento, el factor afectado y qué falló. La fecha y tu usuario se guardan solos.</p>
                    </div>
                    <button onClick={() => setForm({ ...form, open: false })} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar">
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">
                      Evento
                      <select value={form.eventCode} onChange={e => setForm({ ...form, eventCode: e.target.value })} className={`mt-1 ${inputCls}`}>
                        <option value="">Elige un evento…</option>
                        {data.events.map(e => <option key={e.code} value={e.code}>{e.code} · {e.description.slice(0, 60)}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      Factor afectado
                      <select value={form.factor} onChange={e => setForm({ ...form, factor: e.target.value as FactorKey | '' })} className={`mt-1 ${inputCls}`}>
                        <option value="">General (no es un factor en particular)</option>
                        {methodology.factors.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                      Descripción: qué falló
                      <textarea
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        rows={2}
                        maxLength={500}
                        placeholder="Ej.: Monto vacío en la remesa; se aplicó el puntaje 3 (dato faltante)"
                        className={`mt-1 ${inputCls}`}
                      />
                    </label>
                  </div>
                  {formError && <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-rose-600"><AlertCircle className="size-3.5" /> {formError}</p>}
                  <button
                    onClick={register}
                    disabled={busy || !form.eventCode || form.description.trim().length < 10}
                    className="mt-3 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
                  >
                    Registrar incidencia
                  </button>
                </section>
              )}

              <section data-tour="registro" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <h2 className="font-semibold text-navy-900">Registro de incidencias de datos</h2>
                  <p className="text-[11px] text-slate-500">Una fila por incidencia · clic para ver el expediente</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1320px] text-xs">
                    <thead className="bg-navy-900 text-[10px] uppercase tracking-wider text-slate-200">
                      <tr>
                        {['ID', 'Fecha', 'Evento', 'Factor afectado', 'Descripción', 'Causa', 'Detectó', 'Corrigió', 'Impacto en orden', 'Versión resultante', 'Aprobó (Auditor/QA)', 'Estado', 'Días abierta'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.incidents.map((i, idx) => (
                        <tr
                          key={i.id}
                          data-tour={idx === 0 ? 'fila-inc' : undefined}
                          onClick={() => navigate(`/seguimiento/${i.code}`)}
                          className="cursor-pointer align-top transition hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-3 py-2.5 font-bold text-navy-900">
                            <Link to={`/seguimiento/${i.code}`} onClick={e => e.stopPropagation()} className="hover:underline">{i.code}</Link>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{isoDay(i.detectedAt)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium text-navy-900">{i.event.code}</td>
                          <td className="px-3 py-2.5 text-slate-600">{i.factorLabel ?? 'General'}</td>
                          <td className="min-w-[260px] px-3 py-2.5 text-slate-600">{i.description}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{i.cause ? CAUSE_LABEL[i.cause] : '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{i.detectedBy.fullName}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{i.correctedBy?.fullName ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            {i.orderImpact === null ? '—' : i.orderImpact
                              ? <span className="font-semibold text-rose-600">Sí</span>
                              : <span className="text-slate-600">No</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{i.version?.version ?? '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{i.approvedBy?.fullName ?? '—'}</td>
                          <td className="min-w-[150px] px-3 py-2.5">
                            <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${STATUS_STYLE[i.status].badge}`}>
                              {STATUS_STYLE[i.status].label}
                            </span>
                            {i.next && <p className="mt-1 text-[10px] text-slate-500">Sigue: {i.next.label.toLowerCase()} · {whoCan(i.next.roles)}</p>}
                          </td>
                          <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${i.overdue ? 'text-rose-600' : 'text-slate-600'}`}>
                            {i.overdue && <TriangleAlert className="mr-1 inline size-3.5" />}
                            {i.daysOpen}
                          </td>
                        </tr>
                      ))}
                      {data.incidents.length === 0 && (
                        <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-500">No hay incidencias registradas.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === 'flujo' && (
            <section data-tour="flujo-tabla" className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
              <div className="px-4 py-3">
                <h2 className="font-semibold text-navy-900">Flujo del proceso ante datos incorrectos</h2>
                <p className="mt-0.5 text-xs text-slate-500">Cada paso tiene un responsable y deja una evidencia. La última columna dice cuántas incidencias esperan ese paso ahora.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-navy-900 text-[10px] uppercase tracking-wider text-slate-200">
                    <tr>
                      {['Paso', 'Etapa', 'Qué ocurre', 'Responsable (R)', 'Evidencia generada', 'En espera'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {FLOW.map(s => {
                      const waiting = s.status ? data.stats.byStatus[s.status] : null
                      return (
                        <tr key={s.n} className="align-top">
                          <td className="px-3 py-3">
                            <span className="grid size-7 place-items-center rounded-full bg-navy-900 text-xs font-bold text-mint-300">{s.n}</span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-navy-900">{s.stage}</td>
                          <td className="max-w-sm px-3 py-3 text-slate-600">{s.what}</td>
                          <td className="px-3 py-3 text-slate-700">{s.responsible}</td>
                          <td className="px-3 py-3 text-slate-600">{s.evidence}</td>
                          <td className="px-3 py-3 text-center">
                            {waiting === null ? <span className="text-slate-300">—</span>
                              : <span className={`font-bold ${waiting > 0 ? 'text-navy-900' : 'text-slate-300'}`}>{waiting}</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'raci' && (
            <div className="mt-5 space-y-5">
              <section data-tour="raci-tabla" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="px-4 py-3">
                  <h2 className="font-semibold text-navy-900">RACI · Gestión de datos incorrectos – Matriz de priorización LA/FT</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                    {RACI_LEGEND.map(l => (
                      <span key={l.code} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${RACI_STYLE[l.code]}`}>{l.code}</span> {l.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-navy-900 text-[11px] text-slate-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold">#</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Actividad</th>
                        {TEAM_ROLES.map(r => (
                          <th key={r} className={`px-2 py-2.5 text-center font-semibold ${user?.role === r ? 'bg-mint-500/20 text-mint-200' : ''}`}>
                            {ROLE_LABEL[r]}{user?.role === r && <span className="block text-[9px] font-medium uppercase tracking-wider">tu rol</span>}
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-center font-semibold">Validación (1 A)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {RACI.map(a => {
                        const ok = countA(a) === 1
                        return (
                          <tr key={a.n}>
                            <td className="px-3 py-2 text-slate-500">{a.n}</td>
                            <td className="px-3 py-2 text-navy-900">{a.activity}</td>
                            {TEAM_ROLES.map(r => {
                              const code = a.cells[r as keyof typeof a.cells]
                              const before = a.adjusted?.[r as keyof typeof a.cells]
                              return (
                                <td key={r} className="px-1.5 py-1.5 text-center">
                                  <span
                                    className={`relative block rounded px-2 py-1 text-xs font-bold ${RACI_STYLE[code]} ${user?.role === r ? 'ring-2 ring-mint-400' : ''}`}
                                    title={before ? `Ajustado: en la hoja original era «${before}» y la actividad no tenía A` : undefined}
                                  >
                                    {code}
                                    {before && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-rose-500" />}
                                  </span>
                                </td>
                              )
                            })}
                            <td className={`px-3 py-2 text-center text-xs font-bold ${ok ? 'text-mint-700' : 'text-rose-600'}`}>{ok ? 'OK' : 'REVISAR'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="flex items-start gap-1.5 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" />
                  En la hoja original, las actividades 1, 3 y 4 no tenían ninguna A (marcaban «REVISAR»). Se asignó al Líder de proyecto, que responde por
                  el trabajo; el Auditor/QA responde por la evidencia. Ahora cada actividad tiene exactamente una A.
                </p>
              </section>

              <section data-tour="reglas" className="rounded-2xl border border-slate-200/80 bg-white p-5">
                <h2 className="font-semibold text-navy-900">Reglas clave y cómo las aplica el sistema</h2>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
                  {RACI_RULES.map((r, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mint-100 text-[10px] font-bold text-mint-700">{i + 1}</span>
                      <span>
                        {r}
                        <span className="mt-0.5 block text-xs text-slate-500">{RULE_CONTROL[i]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {(can('system.manage') || can('audit.view')) && (
                  <Link
                    to={can('system.manage') ? '/configuracion?tab=permisos' : '/bitacora'}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-mint-700 hover:underline"
                  >
                    Ver qué puede hacer cada rol en el sistema <ArrowRight className="size-3" />
                  </Link>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Control del sistema que hace cumplir cada regla (mismo orden que RACI_RULES).
const RULE_CONTROL = [
  'En Vigía: solo el Auditor/QA ve los botones de aprobar; el servidor rechaza a quien intente aprobar su propia propuesta y lo anota en la bitácora.',
  'En Vigía: quien registró la corrección no puede revalidarla ni cerrarla; el intento queda como INCIDENT_SOD_DENIED.',
  'En Vigía: cada paso queda en el expediente de la incidencia (no se edita ni se borra) y en la bitácora de auditoría.',
  'En Vigía: al revalidar, el sistema compara el orden de atención antes y después; si cambió, no se puede cerrar sin el aviso del líder al patrocinador.',
  'En Vigía: todos los eventos son sintéticos y la aplicación corre solo en el equipo local.',
]
