import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2, Plus, ScanSearch, ShieldMinus, ShieldPlus, Trash2 } from 'lucide-react'
import {
  api, FACTOR_KEYS,
  type Adjustment, type AdjustmentType, type Methodology, type NewRiskEvent as NewEvent,
  type ScreenMatch, type Scores, type Weights,
} from '../lib/api'
import LevelBadge from '../components/matrix/LevelBadge'
import { FACTOR_COLOR, fmtNum } from '../components/matrix/ui'
import { useRegisterTour } from '../lib/tour'
import { startNewEventTour } from '../tours/newEventTour'

const emptyScores = Object.fromEntries(FACTOR_KEYS.map(k => [k, null])) as Scores
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15'

export default function NewRiskEvent() {
  const navigate = useNavigate()
  const [methodology, setMethodology] = useState<Methodology | null>(null)
  const [weights, setWeights] = useState<Weights | null>(null)
  const [form, setForm] = useState<Omit<NewEvent, 'scores' | 'adjustments' | 'amount'> & { amount: string }>({
    description: '', clientName: '', product: '', channel: '', country: '', amount: '', currency: 'USD',
  })
  const [scores, setScores] = useState<Scores>(emptyScores)
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [custom, setCustom] = useState<Adjustment>({ type: 'CONTROL', description: '', points: 2 })
  const [screen, setScreen] = useState<{ loading: boolean; matches: ScreenMatch[] | null }>({ loading: false, matches: null })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.methodology(), api.versions()])
      .then(([m, v]) => {
        setMethodology(m)
        setWeights(v.versions.find(x => x.id === v.currentId)?.weights ?? null)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
  }, [])

  // Vista previa con la misma fórmula del servidor (el servidor recalcula al guardar).
  const preview = useMemo(() => {
    if (!weights || !methodology) return null
    const inherent = Math.round(FACTOR_KEYS.reduce((s, k) => s + (weights[k] * (scores[k] ?? methodology.missingScore)) / 5, 0) * 10) / 10
    const controls = adjustments.filter(a => a.type === 'CONTROL').reduce((s, a) => s + a.points, 0)
    const aggravants = adjustments.filter(a => a.type === 'AGRAVANTE').reduce((s, a) => s + a.points, 0)
    const residual = Math.min(100, Math.max(0, Math.round((inherent - controls + aggravants) * 10) / 10))
    const level = [...methodology.levels].reverse().find(l => residual >= l.min)!.key
    return { inherent, controls, aggravants, residual, level, missing: FACTOR_KEYS.filter(k => scores[k] === null).length }
  }, [weights, methodology, scores, adjustments])

  useRegisterTour(methodology ? startNewEventTour : null)

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function runScreen() {
    setScreen({ loading: true, matches: null })
    try {
      const r = await api.screen(form.clientName)
      setScreen({ loading: false, matches: r.matches })
    } catch (e) {
      setScreen({ loading: false, matches: null })
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api.createRiskEvent({
        ...form,
        amount: form.amount === '' ? null : Number(form.amount),
        scores,
        adjustments,
      })
      navigate('/matriz', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!methodology) {
    return <div className="grid h-64 place-items-center"><Loader2 className="size-7 animate-spin text-mint-500" /></div>
  }

  return (
    <div>
      <Link to="/matriz" className="inline-flex items-center gap-1.5 text-xs font-medium text-mint-700 hover:underline">
        <ArrowLeft className="size-3.5" /> Volver a la matriz
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900">Registrar evento sintético</h1>
      <p className="mt-1 text-sm text-slate-500">Usa solo datos ficticios. No ingreses nombres, cuentas ni datos personales reales.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section data-tour="evento" className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <h2 className="font-semibold text-navy-900">1 · Evento</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-navy-900">Descripción de la señal</span>
                <textarea value={form.description} onChange={set('description')} rows={2} maxLength={500} required className={inputCls} placeholder="Ej. Depósitos en efectivo fraccionados en varias sucursales" />
              </label>
              <label data-tour="cliente" className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-navy-900">Cliente</span>
                <div className="flex gap-2">
                  <input value={form.clientName} onChange={set('clientName')} maxLength={120} required className={inputCls} placeholder="Ej. Comercial Ficticia Zeta, S.A." />
                  <button
                    type="button"
                    onClick={runScreen}
                    disabled={form.clientName.trim().length < 3 || screen.loading}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-medium text-navy-800 hover:border-mint-500 disabled:opacity-50"
                    title="Buscar el nombre en las listas restrictivas internacionales"
                  >
                    {screen.loading ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4 text-mint-600" />} Verificar en listas
                  </button>
                </div>
                {screen.matches && (
                  screen.matches.length === 0 ? (
                    <p className="mt-2 text-xs text-mint-700">Sin coincidencias en las listas restrictivas.</p>
                  ) : (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">{screen.matches.length} posible(s) coincidencia(s). Evalúa el factor PEP / Sanciones:</p>
                      <ul className="mt-1 list-disc pl-4">
                        {screen.matches.map((m, i) => <li key={i}>{m.name} — {m.listName}</li>)}
                      </ul>
                    </div>
                  )
                )}
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-navy-900">Producto</span>
                <input value={form.product} onChange={set('product')} maxLength={120} required className={inputCls} placeholder="Ej. Transferencia internacional" />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-navy-900">Canal</span>
                <input value={form.channel} onChange={set('channel')} maxLength={120} required className={inputCls} placeholder="Ej. Banca en línea" />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-navy-900">País / jurisdicción</span>
                <input value={form.country} onChange={set('country')} maxLength={120} required className={inputCls} placeholder="Ej. Guatemala" />
              </label>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <label>
                  <span className="mb-1 block text-xs font-medium text-navy-900">Monto</span>
                  <input type="number" min={0} step="0.01" value={form.amount} onChange={set('amount')} className={inputCls} placeholder="Opcional" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-medium text-navy-900">Moneda</span>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value as NewEvent['currency'] })} className={inputCls}>
                    <option>USD</option><option>GTQ</option><option>EUR</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section data-tour="factores-form" className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <h2 className="font-semibold text-navy-900">2 · Factores (0 a 5)</h2>
            <p className="mt-0.5 text-xs text-slate-500">Si no tienes el dato, deja «Sin dato»: se usará el puntaje conservador de {methodology.missingScore}.</p>
            <div className="mt-4 space-y-4">
              {methodology.factors.map((f, i) => {
                const v = scores[f.key]
                return (
                  <div key={f.key} data-tour={i === 0 ? 'factor-ejemplo' : undefined}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-navy-900">
                        <span className={`size-2.5 rounded-sm ${FACTOR_COLOR[f.key]}`} /> {f.label}
                        {weights && <span className="text-[11px] font-normal text-slate-400">· peso {weights[f.key]} %</span>}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={f.label}>
                      <button
                        type="button"
                        onClick={() => setScores({ ...scores, [f.key]: null })}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${v === null ? 'bg-amber-100 text-amber-800 ring-amber-300' : 'text-slate-500 ring-slate-200 hover:ring-slate-300'}`}
                      >
                        Sin dato
                      </button>
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setScores({ ...scores, [f.key]: n })}
                          className={`w-9 rounded-md py-1 text-xs font-bold ring-1 ring-inset ${v === n ? 'bg-navy-900 text-mint-300 ring-navy-900' : 'text-navy-800 ring-slate-200 hover:ring-mint-400'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {v === null ? `Dato faltante → se usa ${methodology.missingScore}: «${f.scale[methodology.missingScore]}»` : `${v}: ${f.scale[v]}`}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section data-tour="ajustes-form" className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <h2 className="font-semibold text-navy-900">3 · Controles y agravantes</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(['CONTROL', 'AGRAVANTE'] as AdjustmentType[]).map(t => (
                <div key={t}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t === 'CONTROL' ? 'Controles (restan)' : 'Agravantes (suman)'}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {methodology.catalog[t].map(c => {
                      const on = adjustments.some(a => a.type === t && a.description === c.description)
                      return (
                        <button
                          key={c.description}
                          type="button"
                          onClick={() => setAdjustments(on ? adjustments.filter(a => !(a.type === t && a.description === c.description)) : [...adjustments, { type: t, ...c }])}
                          className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ring-inset transition ${
                            on
                              ? t === 'CONTROL' ? 'bg-mint-50 font-semibold text-mint-800 ring-mint-300' : 'bg-rose-50 font-semibold text-rose-700 ring-rose-300'
                              : 'text-slate-600 ring-slate-200 hover:ring-slate-300'
                          }`}
                        >
                          {c.description} ({t === 'CONTROL' ? '−' : '+'}{c.points})
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div data-tour="ajuste-otro" className="mt-4 grid grid-cols-[7.5rem_1fr_4.5rem_auto] gap-2">
              <select value={custom.type} onChange={e => setCustom({ ...custom, type: e.target.value as AdjustmentType })} className={inputCls}>
                <option value="CONTROL">Control</option>
                <option value="AGRAVANTE">Agravante</option>
              </select>
              <input value={custom.description} onChange={e => setCustom({ ...custom, description: e.target.value })} maxLength={200} placeholder="Otro (descripción)" className={inputCls} />
              <input type="number" min={1} max={20} value={custom.points} onChange={e => setCustom({ ...custom, points: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className={inputCls} aria-label="Puntos" />
              <button
                type="button"
                disabled={custom.description.trim().length < 3 || adjustments.length >= 10}
                onClick={() => { setAdjustments([...adjustments, { ...custom, description: custom.description.trim() }]); setCustom({ ...custom, description: '' }) }}
                className="grid place-items-center rounded-lg border border-slate-300 px-2.5 text-navy-800 hover:border-mint-500 disabled:opacity-50"
                aria-label="Agregar"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {adjustments.length > 0 && (
              <ul className="mt-3 space-y-1">
                {adjustments.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      {a.type === 'CONTROL' ? <ShieldMinus className="size-3.5 text-mint-600" /> : <ShieldPlus className="size-3.5 text-rose-600" />}
                      {a.description}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className={`font-semibold ${a.type === 'CONTROL' ? 'text-mint-700' : 'text-rose-600'}`}>{a.type === 'CONTROL' ? '−' : '+'}{a.points}</span>
                      <button type="button" onClick={() => setAdjustments(adjustments.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" aria-label="Quitar">
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-6">
          {preview && (
            <section data-tour="vista-previa" className="rounded-2xl bg-navy-900 p-5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mint-300/80">Vista previa del puntaje</p>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-300">Riesgo inherente</span><span className="font-semibold">{fmtNum(preview.inherent)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Controles</span><span className="font-semibold text-mint-300">−{preview.controls}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Agravantes</span><span className="font-semibold text-rose-300">+{preview.aggravants}</span></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-sm font-semibold">Residual {fmtNum(preview.residual)}</span>
                <LevelBadge level={preview.level} />
              </div>
              {preview.missing > 0 && (
                <p className="mt-2 text-[11px] text-amber-300">{preview.missing} factor(es) sin dato: puntaje conservador aplicado.</p>
              )}
            </section>
          )}

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="size-4 shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            data-tour="guardar"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-mint-500 to-cyan-500 py-2.5 text-sm font-semibold text-navy-950 shadow-lg shadow-mint-500/25 hover:brightness-105 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Guardar evento'}
          </button>
        </aside>
      </form>
    </div>
  )
}
