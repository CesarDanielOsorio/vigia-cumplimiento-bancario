import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCheck, CornerUpLeft, Loader2, Megaphone, ShieldCheck, TriangleAlert } from 'lucide-react'
import { api, type FactorKey, type IncidentCause, type IncidentDetail as Detail, type Methodology } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL, TEAM_ROLES, whoCan } from '../lib/roles'
import { useRegisterTour } from '../lib/tour'
import { startIncidentDetailTour } from '../tours/incidentDetailTour'
import LevelBadge from '../components/matrix/LevelBadge'
import { FACTOR_COLOR, fmtDate, fmtNum } from '../components/matrix/ui'
import { CAUSE_HELP, CAUSE_LABEL, STATUS_STYLE, STEP_STYLE, fmtDay } from '../components/incidents/incidentUi'
import { FLOW, RACI, RACI_STYLE } from '../components/incidents/raci'

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15'

// Paso del flujo (1-6) que la incidencia está esperando según su estado.
const CURRENT_STEP = { REGISTRADA: 3, DIAGNOSTICADA: 4, CORREGIDA: 5, REVALIDADA: 6, CERRADA: 7 } as const

// Actividad de la matriz RACI que corresponde al siguiente paso.
function raciFor(i: Detail) {
  switch (i.next?.key) {
    case 'diagnose': return 2
    case 'correct': return i.cause === 'CAPTURA' ? 3 : i.cause === 'CALCULO' ? 4 : 5
    case 'revalidate': return 7
    case 'sponsor': return 9
    case 'close': return 8
    default: return null
  }
}

export default function IncidentDetail() {
  const { code = '' } = useParams()
  const { user, can } = useAuth()
  const [i, setI] = useState<Detail | null>(null)
  const [methodology, setMethodology] = useState<Methodology | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [cause, setCause] = useState<IncidentCause | null>(null)
  const [factor, setFactor] = useState<FactorKey | ''>('')
  const [newScore, setNewScore] = useState<number | null>(null)
  const [versionId, setVersionId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([api.incident(code), api.methodology()])
      setI(d); setMethodology(m); setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la incidencia')
    }
  }, [code])
  useEffect(() => { load() }, [load])

  useRegisterTour(i ? startIncidentDetailTour : null)

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('')
    try {
      await fn()
      setNote(''); setReturnNote(''); setCause(null); setFactor(''); setNewScore(null); setVersionId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  if (!i || !methodology) {
    return error
      ? <p role="alert" className="flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="size-4" /> {error}</p>
      : <div className="grid h-64 place-items-center"><Loader2 className="size-7 animate-spin text-mint-500" /></div>
  }

  const step = CURRENT_STEP[i.status]
  const raciN = raciFor(i)
  const raci = RACI.find(a => a.n === raciN)
  const me = user?.username
  const isCorrector = i.correctedBy?.username === me
  const isRevalidator = i.revalidatedBy?.username === me
  const allowed = !!i.next && can(i.next.permission)
  const factorDef = methodology.factors.find(f => f.key === i.factor)
  const current = i.factor ? i.event.scores[i.factor] : null
  const ev = i.evaluation
  const revalidated = i.residualAfter !== null

  return (
    <div>
      <Link to="/seguimiento" className="inline-flex items-center gap-1.5 text-xs font-medium text-mint-700 hover:underline">
        <ArrowLeft className="size-3.5" /> Volver al seguimiento de incidencias
      </Link>

      <header className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Incidencia {i.code}</h1>
        <span data-tour="estado-inc" className={`rounded-md px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${STATUS_STYLE[i.status].badge}`}>
          {STATUS_STYLE[i.status].label}
        </span>
        {i.overdue && (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            <TriangleAlert className="size-3.5" /> {i.daysOpen} días abierta
          </span>
        )}
      </header>

      {/* Avance en el flujo de 6 pasos */}
      <ol data-tour="pasos-inc" className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-navy-900 p-3 sm:grid-cols-6">
        {FLOW.map(s => {
          const done = s.n < step
          const now = s.n === step
          return (
            <li key={s.n} className={`rounded-xl px-3 py-2.5 ${now ? 'bg-mint-400/15 ring-1 ring-inset ring-mint-400/40' : 'bg-white/5'}`}>
              <div className="flex items-center gap-2">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? 'bg-mint-400 text-navy-950' : now ? 'bg-white text-navy-950' : 'bg-white/10 text-slate-400'}`}>
                  {done ? <Check className="size-3.5" /> : s.n}
                </span>
                <span className={`text-sm font-semibold ${done || now ? 'text-white' : 'text-slate-400'}`}>{s.stage}</span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-slate-400">{s.responsible}</p>
            </li>
          )
        })}
      </ol>

      {error && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section data-tour="datos-inc" className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <h2 className="font-semibold text-navy-900">Registro</h2>
            <p className="mt-1 text-sm text-slate-700">{i.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-slate-500">Evento</dt>
                <dd className="font-medium text-navy-900">{i.event.code} · {i.event.description}</dd>
              </div>
              <div><dt className="text-slate-500">Factor afectado</dt><dd className="font-medium text-navy-900">{i.factorLabel ?? 'General'}</dd></div>
              <div><dt className="text-slate-500">Fecha</dt><dd className="font-medium text-navy-900">{fmtDay(i.detectedAt)}</dd></div>
              <div><dt className="text-slate-500">Detectó</dt><dd className="font-medium text-navy-900">{i.detectedBy.fullName}</dd></div>
              <div><dt className="text-slate-500">Al detectar</dt><dd className="font-medium text-navy-900">residual {fmtNum(i.residualBefore)} · {i.rankBefore}.º lugar</dd></div>
              {i.cause && <div><dt className="text-slate-500">Causa</dt><dd className="font-medium text-navy-900">{CAUSE_LABEL[i.cause]}</dd></div>}
              {i.scoreChange && (
                <div>
                  <dt className="text-slate-500">Corrección</dt>
                  <dd className="font-medium text-navy-900">{i.factorLabel}: {i.scoreChange.from ?? 'sin dato'} → {i.scoreChange.to}</dd>
                </div>
              )}
              {i.version && <div><dt className="text-slate-500">Versión</dt><dd className="font-medium text-navy-900">{i.version.version} ({i.version.status.toLowerCase()})</dd></div>}
            </dl>
          </section>

          {/* Revalidación: el score se reproduce factor por factor (Prueba 1) */}
          <section data-tour="revalidacion" className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-navy-900">{revalidated ? 'Revalidación' : 'Score actual del evento'}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Calculado con {ev.version}{i.cause === 'REGLA' && i.version ? ' (la versión vinculada a la corrección)' : ''}. Cualquiera lo puede recalcular a mano.
                </p>
              </div>
              <LevelBadge level={ev.score.level} score={ev.residual} />
            </div>
            <table className="mt-3 w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="py-1.5 text-left font-semibold">Factor</th>
                  <th className="py-1.5 text-right font-semibold">Punt.</th>
                  <th className="py-1.5 text-right font-semibold">Peso</th>
                  <th className="py-1.5 text-right font-semibold">Aporte</th>
                </tr>
              </thead>
              <tbody>
                {ev.score.factors.map(f => (
                  <tr key={f.key} className={`border-b border-slate-50 ${f.key === i.factor ? 'bg-amber-50/70' : ''}`}>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-2 rounded-sm ${FACTOR_COLOR[f.key]}`} /> {f.label}
                        {f.missing && <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">FALTANTE</span>}
                        {f.key === i.factor && <span className="text-[9px] font-semibold uppercase text-amber-700">afectado</span>}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-medium">{f.score}</td>
                    <td className="py-1.5 text-right text-slate-500">{f.weight} %</td>
                    <td className="py-1.5 text-right font-semibold text-navy-900">{fmtNum(f.contribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 font-mono text-[11px] text-slate-500">
              {ev.score.factors.map(f => fmtNum(f.contribution)).join(' + ')} = {fmtNum(ev.score.inherent)} − {ev.score.controls}
              {ev.score.aggravants > 0 && ` + ${ev.score.aggravants}`} = <strong className="text-navy-900">{fmtNum(ev.residual)}</strong>
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3 text-xs">
                <p className="font-semibold text-navy-900">Orden al detectar</p>
                <p className="mt-1 font-mono text-slate-600">{i.rankingBefore.map(c => c === i.event.code ? `[${c}]` : c).join(' › ')}</p>
              </div>
              <div className={`rounded-lg p-3 text-xs ${revalidated ? (i.orderImpact ? 'bg-rose-50' : 'bg-mint-50') : 'bg-slate-50'}`}>
                <p className="font-semibold text-navy-900">{revalidated ? 'Orden después de corregir' : 'Orden ahora'}</p>
                <p className="mt-1 font-mono text-slate-600">{ev.ranking.map(c => c === i.event.code ? `[${c}]` : c).join(' › ')}</p>
              </div>
            </div>
            {revalidated && (
              <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${i.orderImpact ? 'text-rose-700' : 'text-mint-700'}`}>
                {i.orderImpact ? <TriangleAlert className="size-4" /> : <ShieldCheck className="size-4" />}
                Impacto en el orden: {i.orderImpact ? 'Sí' : 'No'} · residual {fmtNum(i.residualBefore)} → {fmtNum(i.residualAfter!)}, {i.rankBefore}.º → {i.rankAfter}.º
              </p>
            )}
          </section>

          <section data-tour="expediente-inc" className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <h2 className="font-semibold text-navy-900">Expediente</h2>
            <p className="mt-0.5 text-xs text-slate-500">Cada paso queda con quién, cuándo y qué. No se puede editar ni borrar.</p>
            <ol className="mt-4 space-y-4">
              {i.activities.map((a, idx) => {
                const st = STEP_STYLE[a.step] ?? STEP_STYLE.NOTA
                const Icon = st.icon
                return (
                  <li key={a.id} className="relative flex gap-3">
                    {idx < i.activities.length - 1 && <span className="absolute left-4 top-9 h-[calc(100%-1.25rem)] w-px bg-slate-200" />}
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${st.color}`}><Icon className="size-4" /></span>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm">
                        <span className="font-semibold text-navy-900">{st.label}</span>
                        <span className="text-slate-500"> · {a.user?.fullName ?? 'Sistema'} · {fmtDate(a.createdAt)}</span>
                      </p>
                      {a.note && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{a.note}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        <aside data-tour="accion-inc" className="h-fit space-y-4 lg:sticky lg:top-6">
          {i.next && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mint-600">Siguiente paso</p>
              <h2 className="mt-0.5 font-semibold text-navy-900">{i.next.label}</h2>
              <p className="mt-0.5 text-xs text-slate-500">Lo hace: <strong className="text-navy-800">{whoCan(i.next.roles)}</strong></p>

              {raci && (
                <div data-tour="raci-paso" className="mt-3 rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">RACI · {raci.activity}</p>
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {TEAM_ROLES.map(r => {
                      const c = raci.cells[r as keyof typeof raci.cells]
                      return (
                        <div key={r} className="text-center" title={ROLE_LABEL[r]}>
                          <span className={`block rounded py-0.5 text-[11px] font-bold ${RACI_STYLE[c]} ${user?.role === r ? 'ring-2 ring-mint-400' : ''}`}>{c}</span>
                          <span className="mt-0.5 block truncate text-[9px] text-slate-500">{ROLE_LABEL[r].replace('Analista de ', 'An. ').replace('Desarrollador ', 'Des. ').replace('Líder de proyecto', 'Líder')}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!allowed ? (
                <p className="mt-3 text-xs text-slate-500">
                  Tu rol ({user?.roleLabel}) no ejecuta este paso. Puedes consultar el expediente; la acción le toca a {whoCan(i.next.roles)}.
                </p>
              ) : i.next.key === 'revalidate' && isCorrector ? (
                <p className="mt-3 text-xs font-medium text-amber-700">Tú registraste la corrección: debe revalidarla otra persona (quien corrige no valida).</p>
              ) : i.next.key === 'close' && (isCorrector || isRevalidator) ? (
                <p className="mt-3 text-xs font-medium text-amber-700">Participaste en la corrección o la revalidación: no puedes aprobar el cierre.</p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {i.next.key === 'diagnose' && (
                    <>
                      <div className="space-y-1.5">
                        {(['CAPTURA', 'REGLA', 'CALCULO'] as IncidentCause[]).map(c => (
                          <button
                            key={c}
                            onClick={() => setCause(c)}
                            className={`w-full rounded-lg px-3 py-2 text-left ring-1 ring-inset transition ${cause === c ? 'bg-mint-50 ring-mint-400' : 'ring-slate-200 hover:ring-slate-300'}`}
                          >
                            <span className="text-sm font-semibold text-navy-900">{CAUSE_LABEL[c]}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">{CAUSE_HELP[c]}</span>
                          </button>
                        ))}
                      </div>
                      {cause === 'CAPTURA' && !i.factor && (
                        <select value={factor} onChange={e => setFactor(e.target.value as FactorKey | '')} className={inputCls}>
                          <option value="">¿Qué factor está mal?</option>
                          {methodology.factors.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                      )}
                    </>
                  )}

                  {i.next.key === 'correct' && i.cause === 'CAPTURA' && factorDef && (
                    <div>
                      <p className="text-xs text-slate-600">
                        <strong className="text-navy-900">{factorDef.label}</strong>: hoy vale {current ?? 'sin dato'}. Elige el puntaje correcto:
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        {[0, 1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => setNewScore(n)}
                            disabled={n === current}
                            className={`size-9 rounded-lg text-sm font-bold ring-1 ring-inset disabled:opacity-30 ${newScore === n ? 'bg-navy-900 text-white ring-navy-900' : 'text-navy-900 ring-slate-200 hover:ring-mint-400'}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      {newScore !== null && <p className="mt-1.5 text-[11px] text-slate-500">{newScore} = {factorDef.scale[newScore]}</p>}
                    </div>
                  )}

                  {i.next.key === 'correct' && i.cause === 'REGLA' && (
                    i.candidates.length === 0 ? (
                      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        Primero propone la versión corregida en{' '}
                        <Link to="/matriz?tab=ponderaciones" className="font-semibold underline">Matriz → Ponderaciones y cambios</Link>. Después vuelve aquí para vincularla.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-600">Vincula la versión que corrige la regla:</p>
                        {i.candidates.map(v => (
                          <button
                            key={v.id}
                            onClick={() => setVersionId(v.id)}
                            className={`w-full rounded-lg px-3 py-2 text-left text-xs ring-1 ring-inset ${versionId === v.id ? 'bg-mint-50 ring-mint-400' : 'ring-slate-200'}`}
                          >
                            <span className="font-bold text-navy-900">{v.version}</span> · {v.status.toLowerCase()}
                            <span className="mt-0.5 block text-slate-500">{v.reason}</span>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {i.next.key === 'close' && i.cause === 'REGLA' && i.version?.status !== 'APROBADA' && (
                    <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                      La versión {i.version?.version} está pendiente. Apruébala primero en{' '}
                      <Link to="/matriz?tab=ponderaciones" className="font-semibold underline">Ponderaciones y cambios</Link>.
                    </p>
                  )}

                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className={inputCls}
                    placeholder={NOTE_PLACEHOLDER[i.next.key]}
                  />
                  <button
                    onClick={() => act(() => {
                      const n = i.next!.key
                      if (n === 'diagnose') return api.diagnoseIncident(i.code, { cause: cause!, factor: factor || undefined, note })
                      if (n === 'correct') return api.correctIncident(i.code, { note, newScore: newScore ?? undefined, versionId: versionId ?? undefined })
                      if (n === 'revalidate') return api.revalidateIncident(i.code, note)
                      if (n === 'sponsor') return api.informSponsor(i.code, note)
                      return api.closeIncident(i.code, note)
                    })}
                    disabled={
                      busy || note.trim().length < 10 ||
                      (i.next.key === 'diagnose' && (!cause || (cause === 'CAPTURA' && !i.factor && !factor))) ||
                      (i.next.key === 'correct' && i.cause === 'CAPTURA' && newScore === null) ||
                      (i.next.key === 'correct' && i.cause === 'REGLA' && !versionId)
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-mint-500 to-cyan-500 py-2.5 text-sm font-semibold text-navy-950 disabled:opacity-50"
                  >
                    {i.next.key === 'sponsor' ? <Megaphone className="size-4" /> : i.next.key === 'close' ? <CheckCheck className="size-4" /> : <ArrowRight className="size-4" />}
                    {BUTTON_LABEL[i.next.key]}
                  </button>

                  {i.next.key === 'close' && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold text-navy-900">¿La evidencia no basta?</p>
                      <input value={returnNote} onChange={e => setReturnNote(e.target.value)} maxLength={1000} className={`mt-2 ${inputCls}`} placeholder="Qué falta corregir (mínimo 10 caracteres)" />
                      <button
                        onClick={() => act(() => api.returnIncident(i.code, returnNote))}
                        disabled={busy || returnNote.trim().length < 10}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                      >
                        <CornerUpLeft className="size-3.5" /> Devolver a corrección
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {i.status === 'CERRADA' && (
            <section className="rounded-2xl bg-navy-900 p-5 text-white">
              <h2 className="flex items-center gap-2 font-semibold"><CheckCheck className="size-5 text-mint-300" /> Incidencia cerrada</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div><dt className="text-slate-400">Aprobó (Auditor/QA)</dt><dd className="font-semibold">{i.approvedBy?.fullName} · {i.closedAt && fmtDate(i.closedAt)}</dd></div>
                <div><dt className="text-slate-400">Versión resultante</dt><dd className="font-semibold">{i.version?.version ?? '—'}</dd></div>
                <div><dt className="text-slate-400">Impacto en el orden</dt><dd className="font-semibold">{i.orderImpact ? 'Sí' : 'No'}</dd></div>
                <div><dt className="text-slate-400">Días abierta</dt><dd className="font-semibold">{i.daysOpen}</dd></div>
                {i.approvalNote && <div><dt className="text-slate-400">Nota</dt><dd>{i.approvalNote}</dd></div>}
              </dl>
            </section>
          )}

          {i.sponsorInformedAt && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-xs text-rose-900">
              <p className="flex items-center gap-1.5 font-semibold"><Megaphone className="size-4" /> Patrocinador informado</p>
              <p className="mt-1">{i.sponsorInformedBy?.fullName} · {fmtDate(i.sponsorInformedAt)}</p>
              <p className="mt-1 text-rose-800">{i.sponsorNote}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

const NOTE_PLACEHOLDER: Record<string, string> = {
  diagnose: 'Por qué es esa causa (mínimo 10 caracteres)',
  correct: 'Qué se corrigió y con qué fuente (mínimo 10 caracteres)',
  revalidate: 'Resultado de la revalidación: ¿se reproduce el score? (mínimo 10 caracteres)',
  sponsor: 'Qué se le informó al patrocinador (mínimo 10 caracteres)',
  close: 'Nota de aprobación de la evidencia (mínimo 10 caracteres)',
}

const BUTTON_LABEL: Record<string, string> = {
  diagnose: 'Guardar diagnóstico',
  correct: 'Registrar corrección',
  revalidate: 'Recalcular y revalidar',
  sponsor: 'Registrar aviso al patrocinador',
  close: 'Aprobar y cerrar',
}
