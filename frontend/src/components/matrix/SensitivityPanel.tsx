import { useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Equal, FlaskConical, Loader2 } from 'lucide-react'
import { api, type Methodology, type SensitivityResult, type Weights } from '../../lib/api'
import WeightEditor from './WeightEditor'
import { fmtNum, sumWeights } from './ui'

const ordinal = (n: number) => `${n}.º`

export default function SensitivityPanel({ methodology, base }: { methodology: Methodology; base: Weights }) {
  // Escenario B del enunciado: Jurisdicción 20 → 30 % y Monto 20 → 10 %.
  const [scenario, setScenario] = useState<Weights>({ ...base, monto: 10, jurisdiccion: 30 })
  const [result, setResult] = useState<SensitivityResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true); setError('')
    try { setResult(await api.sensitivity(scenario)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <section data-tour="escenario" className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h3 className="font-semibold text-navy-900">Escenario de prueba</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Cambia los pesos y compara el riesgo inherente contra la versión vigente. Los cambios en amarillo son los que difieren. Esta prueba no modifica la matriz.
        </p>
        <div className="mt-4">
          <WeightEditor factors={methodology.factors} value={scenario} onChange={setScenario} compareTo={base} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={run}
            disabled={busy || sumWeights(scenario) !== 100}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4 text-mint-400" />} Ejecutar prueba
          </button>
          <button onClick={() => setScenario({ ...base, monto: 10, jurisdiccion: 30 })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-navy-800 hover:border-mint-500">
            Escenario B
          </button>
          <button onClick={() => setScenario({ ...base, monto: 5, frecuencia: 5, jurisdiccion: 5, pep: 50 })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-navy-800 hover:border-mint-500">
            Escenario C (PEP extremo)
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-rose-600"><AlertCircle className="size-4" /> {error}</p>
        )}
      </section>

      <section data-tour="resultado" className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h3 className="font-semibold text-navy-900">Resultado</h3>
        {!result ? (
          <p className="mt-6 text-center text-sm text-slate-500">Ejecuta la prueba para comparar.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 text-left font-semibold">Evento</th>
                    <th className="py-2 text-right font-semibold">Base ({result.version})</th>
                    <th className="py-2 text-right font-semibold">Escenario</th>
                    <th className="py-2 text-center font-semibold">Orden</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(r => {
                    const diff = r.scenario - r.base
                    const moved = r.baseRank !== r.scenarioRank
                    return (
                      <tr key={r.code} className={`border-b border-slate-50 ${moved ? 'bg-amber-50/60' : ''}`}>
                        <td className="py-2"><span className="font-bold text-navy-900">{r.code}</span></td>
                        <td className="py-2 text-right">{fmtNum(r.base)}</td>
                        <td className="py-2 text-right font-semibold text-navy-900">
                          {fmtNum(r.scenario)}
                          {diff !== 0 && <span className={`ml-1 text-[10px] ${diff > 0 ? 'text-rose-600' : 'text-mint-700'}`}>({diff > 0 ? '+' : ''}{fmtNum(diff)})</span>}
                        </td>
                        <td className="py-2 text-center text-xs">
                          <span className="inline-flex items-center gap-1">
                            {ordinal(r.baseRank)}
                            {!moved ? <Equal className="size-3 text-slate-400" /> : r.scenarioRank < r.baseRank ? <ArrowUp className="size-3 text-rose-600" /> : <ArrowDown className="size-3 text-mint-600" />}
                            {ordinal(r.scenarioRank)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className={`mt-4 rounded-lg px-3 py-2.5 text-sm font-medium ${result.orderChanged ? 'bg-amber-50 text-amber-800' : 'bg-mint-50 text-mint-800'}`}>
              {result.orderChanged
                ? 'El orden de atención CAMBIA con este escenario: la priorización es sensible a estos pesos.'
                : 'El orden de atención no cambia con este escenario: la priorización es estable.'}
            </p>
            <p className="mt-3 text-[11px] text-slate-500">
              <strong>Limitaciones:</strong> la comparación usa el riesgo inherente (sin controles ni agravantes), los puntajes son juicios del analista y los eventos son sintéticos; el resultado no generaliza a datos reales.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
