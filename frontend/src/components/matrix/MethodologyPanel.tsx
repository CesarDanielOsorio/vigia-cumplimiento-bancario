import { ShieldMinus, ShieldPlus } from 'lucide-react'
import type { Methodology, Weights } from '../../lib/api'
import { FACTOR_COLOR, LEVEL_STYLE } from './ui'

export default function MethodologyPanel({ methodology, weights }: { methodology: Methodology; weights: Weights }) {
  return (
    <div className="space-y-5">
      <section data-tour="formulas" className="grid gap-4 md:grid-cols-3">
        {[
          ['1 · Inherente', 'Σ (peso × puntaje ÷ 5)', 'Siete factores de 0 a 5, ponderados. Escala de 0 a 100.'],
          ['2 · Ajuste', 'Residual = inherente − controles + agravantes', 'Los controles compensatorios restan puntos y los agravantes suman. Se muestran por separado.'],
          ['3 · Dato faltante', `Puntaje conservador de ${methodology.missingScore}`, 'Se marca como «dato faltante». El evento nunca se descarta por falta de información.'],
        ].map(([t, f, d]) => (
          <div key={t} className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mint-700">{t}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-navy-900">{f}</p>
            <p className="mt-1 text-xs text-slate-500">{d}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h3 className="font-semibold text-navy-900">Niveles de riesgo</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {methodology.levels.map(l => (
            <div key={l.key} className={`rounded-lg px-3 py-2.5 text-center text-white ${LEVEL_STYLE[l.key].solid}`}>
              <p className="text-xs font-bold">{LEVEL_STYLE[l.key].label}</p>
              <p className="text-[11px] opacity-90">{l.min}–{l.max}</p>
            </div>
          ))}
        </div>
      </section>

      <section data-tour="diccionario" className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h3 className="font-semibold text-navy-900">Diccionario de factores</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="bg-navy-900 text-[10px] uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Factor</th>
                <th className="px-3 py-2.5 text-right font-semibold">Peso</th>
                {[0, 1, 2, 3, 4, 5].map(n => <th key={n} className="px-3 py-2.5 text-left font-semibold">{n}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {methodology.factors.map(f => (
                <tr key={f.key} className="align-top">
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 font-semibold text-navy-900">
                      <span className={`size-2.5 shrink-0 rounded-sm ${FACTOR_COLOR[f.key]}`} /> {f.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{f.question}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{weights[f.key]} %</td>
                  {f.scale.map((s, i) => <td key={i} className="px-3 py-2.5 text-slate-600">{s}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section data-tour="mapa" className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h3 className="font-semibold text-navy-900">Mapa de controles y agravantes</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {(['CONTROL', 'AGRAVANTE'] as const).map(t => (
            <div key={t}>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t === 'CONTROL' ? <ShieldMinus className="size-3.5 text-mint-600" /> : <ShieldPlus className="size-3.5 text-rose-600" />}
                {t === 'CONTROL' ? 'Controles compensatorios (restan)' : 'Agravantes (suman)'}
              </p>
              <ul className="mt-2 space-y-1">
                {methodology.catalog[t].map(c => (
                  <li key={c.description} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="text-slate-600">{c.description}</span>
                    <span className={`font-semibold ${t === 'CONTROL' ? 'text-mint-700' : 'text-rose-600'}`}>{t === 'CONTROL' ? '−' : '+'}{c.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Evidencia: cada control aplicado queda registrado en el evento, y cada alta de evento, cambio de pesos y prueba de sensibilidad queda en la bitácora de auditoría.</p>
      </section>
    </div>
  )
}
