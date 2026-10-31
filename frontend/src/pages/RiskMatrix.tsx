import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, BookOpen, FlaskConical, Info, LayoutList, Loader2, Plus, SlidersHorizontal } from 'lucide-react'
import { api, type Methodology, type RiskEvent, type WeightVersion } from '../lib/api'
import { useAuth } from '../lib/auth'
import Board from '../components/matrix/Board'
import WeightsPanel from '../components/matrix/WeightsPanel'
import SensitivityPanel from '../components/matrix/SensitivityPanel'
import MethodologyPanel from '../components/matrix/MethodologyPanel'
import { LEVEL_STYLE } from '../components/matrix/ui'
import { useRegisterTour } from '../lib/tour'
import { startMatrixTour } from '../tours/matrixTour'

const TABS = [
  { key: 'tablero', label: 'Tablero', icon: LayoutList },
  { key: 'ponderaciones', label: 'Ponderaciones y cambios', icon: SlidersHorizontal },
  { key: 'sensibilidad', label: 'Sensibilidad', icon: FlaskConical },
  { key: 'metodologia', label: 'Metodología', icon: BookOpen },
] as const

export default function RiskMatrix() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find(t => t.key === params.get('tab'))?.key ?? 'tablero'
  const [methodology, setMethodology] = useState<Methodology | null>(null)
  const [data, setData] = useState<{ version: WeightVersion; events: RiskEvent[] } | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [m, d] = await Promise.all([api.methodology(), api.riskEvents()])
      setMethodology(m)
      setData(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la matriz')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const canCreate = can('events.create')
  const tourFn = useCallback(
    () => startMatrixTour({ goTab: t => setParams({ tab: t }, { replace: true }), canCreate }),
    [setParams, canCreate],
  )
  useRegisterTour(data && methodology ? tourFn : null)

  const counts = data?.events.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.score.level]: (acc[e.score.level] ?? 0) + 1 }), {})

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint-600">Cumplimiento · Priorización LA/FT</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Matriz de priorización de eventos</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Ordena las señales de riesgo de lavado de activos y financiamiento del terrorismo con criterios homogéneos, explicables y auditables. Dice dónde mirar primero y por qué.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {data && (
            <span data-tour="version" className="self-start rounded-md bg-navy-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 sm:self-end">
              Versión de parámetros <span className="text-mint-300">{data.version.version}</span>
            </span>
          )}
          {canCreate && (
            <Link
              data-tour="registrar"
              to="/matriz/nuevo"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-mint-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-navy-950 shadow-lg shadow-mint-500/25 hover:brightness-105"
            >
              <Plus className="size-4" /> Registrar evento
            </Link>
          )}
        </div>
      </header>

      <div data-tour="regla" className="mt-4 flex items-start gap-2 rounded-lg border border-navy-900/10 bg-navy-900 px-4 py-3 text-xs text-slate-300">
        <Info className="mt-0.5 size-4 shrink-0 text-mint-400" />
        <p>
          <strong className="text-white">Regla de oro:</strong> el score ordena la atención; no reemplaza la investigación ni decide reportes. Escalar o reportar sigue siendo decisión del especialista.
          Los eventos, clientes y cifras son <strong className="text-white">sintéticos</strong> (prototipo académico).
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {!data || !methodology ? (
        !error && <div className="grid h-64 place-items-center"><Loader2 className="size-7 animate-spin text-mint-500" /></div>
      ) : (
        <>
          <section data-tour="niveles" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {methodology.levels.map(l => (
              <div key={l.key} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold tracking-wide ${LEVEL_STYLE[l.key].text}`}>{LEVEL_STYLE[l.key].label}</span>
                  <span className={`size-2 rounded-full ${LEVEL_STYLE[l.key].solid}`} />
                </div>
                <p className="mt-1 text-2xl font-extrabold text-navy-900">{counts?.[l.key] ?? 0}</p>
                <p className="text-[10px] text-slate-500">eventos · {l.min}–{l.max}</p>
              </div>
            ))}
          </section>

          <nav data-tour="pestanas" className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setParams({ tab: key }, { replace: true })}
                className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  tab === key ? 'border-mint-500 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-900'
                }`}
              >
                <Icon className={`size-4 ${tab === key ? 'text-mint-600' : ''}`} /> {label}
              </button>
            ))}
          </nav>

          <div className="mt-5">
            {tab === 'tablero' && <Board events={data.events} methodology={methodology} />}
            {tab === 'ponderaciones' && <WeightsPanel methodology={methodology} onApproved={load} />}
            {tab === 'sensibilidad' && <SensitivityPanel methodology={methodology} base={data.version.weights} />}
            {tab === 'metodologia' && <MethodologyPanel methodology={methodology} weights={data.version.weights} />}
          </div>
        </>
      )}
    </div>
  )
}
