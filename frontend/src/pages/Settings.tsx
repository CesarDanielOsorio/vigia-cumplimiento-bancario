import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, Copy, KeyRound, Loader2, LockOpen, Plus, RotateCcw, Save, ShieldCheck, SlidersHorizontal, UserCog, Users, X,
} from 'lucide-react'
import { api, type AdminUser, type Role, type Settings as SettingsT, type SettingsResponse } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL } from '../lib/roles'
import { useRegisterTour } from '../lib/tour'
import { startSettingsTour } from '../tours/settingsTour'
import PermissionsTable from '../components/admin/PermissionsTable'
import { fmtDate } from '../components/matrix/ui'
import { timeAgo } from '../lib/timeAgo'

const TABS = [
  { key: 'usuarios', label: 'Usuarios y roles', icon: Users },
  { key: 'permisos', label: 'Permisos por rol', icon: ShieldCheck },
  { key: 'parametros', label: 'Parámetros', icon: SlidersHorizontal },
  { key: 'demostracion', label: 'Demostración', icon: RotateCcw },
] as const
type Tab = (typeof TABS)[number]['key']

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15'

const FIELDS: { key: keyof SettingsT; label: string; unit: string; min: number; max: number; help: string; group: 'seguridad' | 'operacion' }[] = [
  { key: 'sessionMinutes', label: 'Duración de la sesión', unit: 'min', min: 5, max: 240, group: 'seguridad', help: 'Después de este tiempo hay que volver a iniciar sesión. Aplica a los inicios de sesión nuevos.' },
  { key: 'maxFailedAttempts', label: 'Intentos fallidos antes de bloquear', unit: 'intentos', min: 3, max: 10, group: 'seguridad', help: 'Al llegar a este número de contraseñas incorrectas, la cuenta se bloquea.' },
  { key: 'lockMinutes', label: 'Duración del bloqueo', unit: 'min', min: 5, max: 120, group: 'seguridad', help: 'Tiempo que la cuenta queda bloqueada. El administrador puede desbloquearla antes.' },
  { key: 'listStaleHours', label: 'Listas desactualizadas después de', unit: 'horas', min: 12, max: 168, group: 'operacion', help: 'Si las listas restrictivas no se sincronizan en este tiempo, se muestra una alerta.' },
  { key: 'incidentSlaDays', label: 'Plazo para cerrar una incidencia', unit: 'días', min: 1, max: 30, group: 'operacion', help: 'Las incidencias abiertas más tiempo se marcan como vencidas en el seguimiento.' },
]

// Guion de la demostración de INC-002: qué paso hace cada rol del RACI y con qué usuario se ejecuta.
const DEMO_STEPS: { step: string; who: string; user: string; note?: string }[] = [
  { step: 'Registro', who: 'Analista de riesgo', user: 'ya viene hecho', note: 'INC-002 llega registrada por «analista».' },
  { step: 'Diagnóstico', who: 'Analista de datos', user: 'admin', note: 'Causa: error de captura.' },
  { step: 'Corrección', who: 'Analista de riesgo', user: 'analista', note: 'Jurisdicción 1 → 4. Si la hace el admin, ya no puede revalidar.' },
  { step: 'Revalidación', who: 'Analista de datos', user: 'admin', note: 'EV-005 pasa de 50 a 62 y del 3.º al 2.º lugar: impacto Sí.' },
  { step: 'Aviso al patrocinador', who: 'Líder de proyecto', user: 'admin' },
  { step: 'Cierre', who: 'Auditor/QA', user: 'auditor', note: 'Nadie más puede cerrar, ni el administrador.' },
]

export default function Settings() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find(t => t.key === params.get('tab'))?.key ?? 'usuarios'
  const goTab = useCallback((t: Tab) => setParams({ tab: t }, { replace: true }), [setParams])

  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [cfg, setCfg] = useState<SettingsResponse | null>(null)
  const [draft, setDraft] = useState<SettingsT | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [newUser, setNewUser] = useState<{ open: boolean; username: string; fullName: string; role: Role }>({ open: false, username: '', fullName: '', role: 'ANALISTA_RIESGO' })
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([api.users(), api.settings()])
      setUsers(u.users); setCfg(s); setDraft(s.settings)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const tourFn = useCallback(() => startSettingsTour({ goTab }), [goTab])
  useRegisterTour(users && cfg ? tourFn : null)

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true); setError(''); setNotice('')
    try { await fn(); if (done) setNotice(done); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setBusy(false) }
  }

  const dirty = !!draft && !!cfg && FIELDS.some(f => draft[f.key] !== cfg.settings[f.key])

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint-600">Administración del sistema</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Configuración</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-500">
          Usuarios, roles y parámetros de seguridad. Cada cambio queda en la bitácora de auditoría con tu usuario. Los parámetros de la matriz no se
          cambian aquí: pasan por control de cambios y los aprueba el Auditor/QA.
        </p>
      </header>

      {secret && (
        <div className="mt-5 rounded-xl border border-mint-300 bg-mint-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-navy-900"><KeyRound className="size-4 text-mint-700" /> Contraseña temporal de «{secret.username}»</p>
              <p className="mt-0.5 text-xs text-slate-600">Cópiala y entrégala en persona. Solo se muestra esta vez; en la base de datos solo queda su hash.</p>
            </div>
            <button onClick={() => setSecret(null)} className="rounded-lg p-1 text-slate-500 hover:bg-mint-100" aria-label="Cerrar"><X className="size-4" /></button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg bg-white px-3 py-2 font-mono text-sm font-semibold text-navy-900 ring-1 ring-mint-200">{secret.password}</code>
            <button onClick={() => navigator.clipboard?.writeText(secret.password)} className="inline-flex items-center gap-1 rounded-lg border border-mint-300 px-2.5 py-2 text-xs font-medium text-mint-800 hover:bg-mint-100">
              <Copy className="size-3.5" /> Copiar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}
      {notice && <p className="mt-5 rounded-lg border border-mint-200 bg-mint-50 px-4 py-2.5 text-sm text-mint-800">{notice}</p>}

      <nav data-tour="pestanas-cfg" className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
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

      {!users || !cfg || !draft ? (
        !error && <div className="grid h-64 place-items-center"><Loader2 className="size-7 animate-spin text-mint-500" /></div>
      ) : (
        <div className="mt-5">
          {tab === 'usuarios' && (
            <div className="space-y-5">
              <section data-tour="usuarios" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <h2 className="font-semibold text-navy-900">Usuarios</h2>
                    <p className="text-xs text-slate-500">Un rol por persona. No puedes cambiar tu propio rol ni desactivarte, y siempre queda un administrador activo.</p>
                  </div>
                  <button
                    data-tour="nuevo-usuario"
                    onClick={() => setNewUser({ ...newUser, open: true })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-800"
                  >
                    <Plus className="size-3.5" /> Nuevo usuario
                  </button>
                </div>

                {newUser.open && (
                  <div className="grid gap-2 border-y border-slate-100 bg-slate-50 px-4 py-3 sm:grid-cols-[1fr_1.4fr_1.2fr_auto]">
                    <input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="usuario (ej. jperez)" className={inputCls} />
                    <input value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Nombre completo" className={inputCls} />
                    <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })} className={inputCls}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button
                        disabled={busy || newUser.username.trim().length < 3 || newUser.fullName.trim().length < 3}
                        onClick={() => act(async () => {
                          const r = await api.createUser({ username: newUser.username, fullName: newUser.fullName, role: newUser.role })
                          setSecret({ username: r.user.username, password: r.password })
                          setNewUser({ open: false, username: '', fullName: '', role: 'ANALISTA_RIESGO' })
                        })}
                        className="rounded-lg bg-mint-600 px-3 py-2 text-xs font-semibold text-white hover:bg-mint-700 disabled:opacity-50"
                      >
                        Crear
                      </button>
                      <button onClick={() => setNewUser({ ...newUser, open: false })} className="rounded-lg px-2 text-xs text-slate-500 hover:text-navy-900">Cancelar</button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-navy-900 text-[10px] uppercase tracking-wider text-slate-200">
                      <tr>
                        {['Usuario', 'Rol', 'Estado', 'Último acceso', 'Acciones'].map(h => <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map(u => {
                        const self = u.id === user?.id
                        return (
                          <tr key={u.id} className={u.active ? '' : 'bg-slate-50 text-slate-400'}>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-navy-900">{u.fullName}{self && <span className="ml-1.5 text-[10px] font-semibold uppercase text-mint-600">tú</span>}</p>
                              <p className="font-mono text-[11px] text-slate-500">{u.username}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={u.role}
                                disabled={busy || self}
                                onChange={e => act(() => api.updateUser(u.id, { role: e.target.value as Role }), `Rol de ${u.username} actualizado.`)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:opacity-60"
                              >
                                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-xs">
                              {!u.active ? <span className="font-semibold text-slate-500">Inactivo</span>
                                : u.locked ? <span className="font-semibold text-rose-600">Bloqueado hasta {fmtDate(u.lockedUntil!)}</span>
                                : <span className="font-semibold text-mint-700">Activo</span>}
                              {u.active && !u.locked && u.failedAttempts > 0 && <p className="text-[11px] text-amber-700">{u.failedAttempts} intento(s) fallido(s)</p>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Nunca'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                {u.locked && (
                                  <button onClick={() => act(() => api.unlockUser(u.id), `${u.username} desbloqueado.`)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-navy-800 hover:border-mint-500">
                                    <LockOpen className="size-3" /> Desbloquear
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (!window.confirm(`¿Generar una contraseña temporal nueva para ${u.username}? La actual dejará de funcionar.`)) return
                                    act(async () => { const r = await api.resetPassword(u.id); setSecret({ username: u.username, password: r.password }) })
                                  }}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-navy-800 hover:border-mint-500"
                                >
                                  <KeyRound className="size-3" /> Restablecer contraseña
                                </button>
                                {!self && (
                                  <button
                                    onClick={() => act(() => api.updateUser(u.id, { active: !u.active }), `${u.username} ${u.active ? 'desactivado' : 'activado'}.`)}
                                    disabled={busy}
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset ${u.active ? 'text-rose-700 ring-rose-200 hover:bg-rose-50' : 'text-mint-700 ring-mint-200 hover:bg-mint-50'}`}
                                  >
                                    <UserCog className="size-3" /> {u.active ? 'Desactivar' : 'Activar'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === 'permisos' && (
            <section data-tour="permisos" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
              <div className="px-4 py-3">
                <h2 className="font-semibold text-navy-900">Permisos por rol</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Lo que el servidor permite a cada rol (mínimo privilegio). El administrador ve todo y ejecuta las tareas operativas, pero las aprobaciones son
                  del Auditor/QA: así nadie, ni el administrador, aprueba lo que propuso.
                </p>
              </div>
              <PermissionsTable highlight={user?.role} />
              <Link to="/seguimiento?tab=raci" className="flex items-center gap-1 border-t border-slate-100 px-4 py-3 text-xs font-medium text-mint-700 hover:underline">
                Ver la matriz RACI del equipo <ArrowRight className="size-3" />
              </Link>
            </section>
          )}

          {tab === 'parametros' && (
            <div className="grid gap-5 lg:grid-cols-2">
              {(['seguridad', 'operacion'] as const).map(group => (
                <section key={group} data-tour={`param-${group}`} className="rounded-2xl border border-slate-200/80 bg-white p-5">
                  <h2 className="font-semibold text-navy-900">{group === 'seguridad' ? 'Seguridad de acceso' : 'Operación'}</h2>
                  <div className="mt-4 space-y-4">
                    {FIELDS.filter(f => f.group === group).map(f => (
                      <label key={f.key} className="block">
                        <span className="flex items-center justify-between gap-3 text-sm font-medium text-navy-900">
                          {f.label}
                          <span className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={f.min}
                              max={f.max}
                              value={draft[f.key]}
                              onChange={e => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
                              className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-mint-500"
                            />
                            <span className="w-14 text-xs text-slate-500">{f.unit}</span>
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">{f.help} Rango: {f.min}–{f.max}.</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}

              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {cfg.updatedBy ? <>Último cambio: {cfg.updatedBy.fullName} · {fmtDate(cfg.updatedAt!)}</> : 'Valores por defecto (sin cambios registrados).'}
                  </p>
                  <div className="flex gap-2">
                    {dirty && <button onClick={() => setDraft(cfg.settings)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-navy-900">Descartar</button>}
                    <button
                      data-tour="guardar-cfg"
                      onClick={() => act(() => api.saveSettings(draft), 'Parámetros guardados. El cambio quedó en la bitácora.')}
                      disabled={busy || !dirty}
                      className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
                    >
                      <Save className="size-4 text-mint-400" /> Guardar parámetros
                    </button>
                  </div>
                </div>
              </section>

              <section data-tour="param-matriz" className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 lg:col-span-2">
                <h2 className="font-semibold text-navy-900">Parámetros de la matriz (solo lectura)</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Se cambian proponiendo una versión nueva; la aprueba el Auditor/QA y queda en el control de cambios.
                </p>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                  <div className="rounded-lg bg-white p-3">
                    <dt className="text-slate-500">Versión vigente</dt>
                    <dd className="mt-0.5 text-lg font-bold text-navy-900">{cfg.matrix.version ?? '—'}</dd>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <dt className="text-slate-500">Dato faltante</dt>
                    <dd className="mt-0.5 font-semibold text-navy-900">puntaje conservador de {cfg.matrix.missingScore}</dd>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <dt className="text-slate-500">Niveles</dt>
                    <dd className="mt-0.5 font-semibold text-navy-900">{cfg.matrix.levels.map(l => `${l.label} ${l.min}–${l.max}`).join(' · ')}</dd>
                  </div>
                </dl>
                <Link to="/matriz?tab=ponderaciones" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-mint-700 hover:underline">
                  Ir a Ponderaciones y cambios <ArrowRight className="size-3" />
                </Link>
              </section>
            </div>
          )}

          {tab === 'demostracion' && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
                <h2 className="font-semibold text-navy-900">Restablecer demostración</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Deja la matriz y el seguimiento como recién instalados para volver a ensayar la presentación.
                </p>
                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                    <p className="font-semibold text-amber-900">Se restablece</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-900/90">
                      <li>Incidencias: vuelven INC-001 (cerrada) e INC-002 (registrada)</li>
                      <li>Eventos EV-001 a EV-005 con sus puntajes originales</li>
                      <li>Se borran eventos y versiones de pesos creados en los ensayos</li>
                      <li>Se desbloquean las cuentas bloqueadas</li>
                    </ul>
                  </div>
                  <div className="rounded-lg bg-mint-50 p-3 ring-1 ring-mint-200">
                    <p className="font-semibold text-mint-900">Se conserva</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-mint-900/90">
                      <li>Usuarios y contraseñas</li>
                      <li>Listas restrictivas descargadas</li>
                      <li>Parámetros del sistema</li>
                      <li>La bitácora: el restablecimiento queda registrado</li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!window.confirm('¿Restablecer la demostración?\n\nSe borran las incidencias, eventos y versiones de pesos creados en los ensayos, y vuelven INC-001 e INC-002 como al instalar. Usuarios, listas, parámetros y bitácora no se tocan.')) return
                    act(async () => {
                      const r = await api.resetDemo()
                      const extra = [r.events && `${r.events} evento(s)`, r.versions && `${r.versions} versión(es) de pesos`].filter(Boolean)
                      setNotice(`Demostración restablecida: INC-002 está otra vez en «Registrada»${extra.length ? ` y se borraron ${extra.join(' y ')} de ensayo` : ''}.`)
                    })
                  }}
                  disabled={busy}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin text-mint-400" /> : <RotateCcw className="size-4 text-mint-400" />} Restablecer demostración
                </button>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <div className="px-4 py-3">
                  <h2 className="font-semibold text-navy-900">Guion sugerido · INC-002</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    El administrador puede hacer casi todo, pero el sistema no lo deja revalidar su propia corrección ni cerrar: eso es la segregación de funciones.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="bg-navy-900 text-[10px] uppercase tracking-wider text-slate-200">
                      <tr>{['Paso', 'Rol que lo hace (RACI)', 'Usuario en la demo'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {DEMO_STEPS.map(d => (
                        <tr key={d.step}>
                          <td className="px-3 py-2 font-semibold text-navy-900">{d.step}</td>
                          <td className="px-3 py-2 text-slate-600">{d.who}{d.note && <p className="text-[11px] text-slate-400">{d.note}</p>}</td>
                          <td className="px-3 py-2"><code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-navy-900">{d.user}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Link to="/seguimiento/INC-002" className="flex items-center gap-1 border-t border-slate-100 px-4 py-3 text-xs font-medium text-mint-700 hover:underline">
                  Abrir INC-002 <ArrowRight className="size-3" />
                </Link>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
