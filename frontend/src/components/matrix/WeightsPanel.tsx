import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, GitPullRequestArrow, Loader2, X } from 'lucide-react'
import { api, type Methodology, type WeightVersion, type Weights } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import WeightEditor from './WeightEditor'
import { fmtDate, sumWeights } from './ui'

const STATUS_STYLE: Record<WeightVersion['status'], string> = {
  APROBADA: 'bg-mint-50 text-mint-700 ring-mint-200',
  PROPUESTA: 'bg-amber-50 text-amber-700 ring-amber-200',
  RECHAZADA: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export default function WeightsPanel({ methodology, onApproved }: { methodology: Methodology; onApproved: () => void }) {
  const { user, can } = useAuth()
  const [data, setData] = useState<{ currentId: number | null; versions: WeightVersion[] } | null>(null)
  const [draft, setDraft] = useState<Weights | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api.versions()) } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }, [])
  useEffect(() => { load() }, [load])

  const current = data?.versions.find(v => v.id === data.currentId)
  const pending = data?.versions.find(v => v.status === 'PROPUESTA')
  const canPropose = can('weights.propose')
  const canReview = can('weights.approve')

  async function act(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true); setError('')
    try { await fn(); after?.(); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setBusy(false) }
  }

  if (!data) return <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-mint-500" /></div>

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section data-tour="pesos" className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Ponderaciones vigentes</h3>
          {current && <span className="rounded-md bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-mint-300">{current.version}</span>}
        </div>
        {current && <div className="mt-4"><WeightEditor factors={methodology.factors} value={current.weights} /></div>}

        <div data-tour="proponer" className="mt-6 border-t border-slate-100 pt-5">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <GitPullRequestArrow className="size-4 text-mint-600" /> Proponer cambio de ponderaciones
          </h4>
          {!canPropose ? (
            <p className="mt-2 text-xs text-slate-500">Tu rol ({user?.roleLabel}) no propone cambios de ponderaciones. Según el RACI los propone el analista de datos o el líder de proyecto, y los aprueba el Auditor/QA.</p>
          ) : pending ? (
            <p className="mt-2 text-xs text-slate-500">Hay una propuesta pendiente ({pending.version}). Debe revisarse antes de crear otra.</p>
          ) : !draft ? (
            <button onClick={() => setDraft({ ...current!.weights })} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-navy-800 hover:border-mint-500">
              Nueva propuesta
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <WeightEditor factors={methodology.factors} value={draft} onChange={setDraft} compareTo={current?.weights} />
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="¿Por qué se propone este cambio? (mínimo 10 caracteres)"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy || sumWeights(draft) !== 100 || reason.trim().length < 10}
                  onClick={() => act(() => api.proposeVersion(draft, reason), () => { setDraft(null); setReason('') })}
                  className="rounded-lg bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
                >
                  Enviar a aprobación
                </button>
                <button onClick={() => { setDraft(null); setReason('') }} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-navy-900">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section data-tour="cambios" className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h3 className="font-semibold text-navy-900">Control de cambios</h3>
        <p className="mt-0.5 text-xs text-slate-500">Cada cambio guarda quién, cuándo, por qué y quién lo aprobó. Nadie puede aprobar su propia propuesta.</p>

        {error && (
          <div role="alert" className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        )}

        <ol className="mt-4 space-y-3">
          {data.versions.map(v => {
            const own = v.createdBy.username === user?.username
            return (
              <li key={v.id} className={`rounded-xl border p-3.5 ${v.id === data.currentId ? 'border-mint-300 bg-mint-50/40' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-navy-900">
                    {v.version}
                    {v.id === data.currentId && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-mint-700">vigente</span>}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${STATUS_STYLE[v.status]}`}>{v.status}</span>
                </div>
                <dl className="mt-2 space-y-0.5 text-xs">
                  <div><dt className="inline font-semibold text-navy-900">Quién: </dt><dd className="inline text-slate-600">{v.createdBy.fullName} ({v.createdBy.username}) · {fmtDate(v.createdAt)}</dd></div>
                  <div><dt className="inline font-semibold text-navy-900">Por qué: </dt><dd className="inline text-slate-600">{v.reason}</dd></div>
                  {v.reviewedBy && (
                    <div>
                      <dt className="inline font-semibold text-navy-900">{v.status === 'APROBADA' ? 'Aprobó' : 'Rechazó'}: </dt>
                      <dd className="inline text-slate-600">{v.reviewedBy.fullName} · {fmtDate(v.reviewedAt!)} — “{v.reviewNote}”</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-2 font-mono text-[10px] text-slate-400">
                  {methodology.factors.map(f => `${f.short} ${v.weights[f.key]}`).join(' · ')}
                </p>

                {v.status === 'PROPUESTA' && canReview && (
                  own ? (
                    <p className="mt-2 text-[11px] font-medium text-amber-700">Es tu propuesta: debe aprobarla otra persona.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <input
                        value={notes[v.id] ?? ''}
                        onChange={e => setNotes({ ...notes, [v.id]: e.target.value })}
                        maxLength={500}
                        placeholder="Nota de revisión (obligatoria)"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-mint-500"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={busy || (notes[v.id] ?? '').trim().length < 5}
                          onClick={() => act(() => api.reviewVersion(v.id, true, notes[v.id]), onApproved)}
                          className="inline-flex items-center gap-1 rounded-lg bg-mint-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-mint-700 disabled:opacity-50"
                        >
                          <Check className="size-3.5" /> Aprobar
                        </button>
                        <button
                          disabled={busy || (notes[v.id] ?? '').trim().length < 5}
                          onClick={() => act(() => api.reviewVersion(v.id, false, notes[v.id]))}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X className="size-3.5" /> Rechazar
                        </button>
                      </div>
                    </div>
                  )
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
