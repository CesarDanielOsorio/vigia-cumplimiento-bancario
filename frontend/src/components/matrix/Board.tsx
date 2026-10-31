import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, ShieldMinus, ShieldPlus } from 'lucide-react'
import type { Methodology, RiskEvent } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import LevelBadge from './LevelBadge'
import { FACTOR_COLOR, LEVEL_STYLE, fmtNum } from './ui'

interface Props {
  events: RiskEvent[]
  methodology: Methodology
}

export default function Board({ events, methodology }: Props) {
  const { can } = useAuth()
  const canReport = can('incidents.register')
  const [selected, setSelected] = useState(events[0]?.code)
  const detail = events.find(e => e.code === selected) ?? events[0]

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* Ranking */}
      <section data-tour="ranking" className="rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-b border-slate-100 px-4 py-3">
          {methodology.factors.map(f => (
            <span key={f.key} className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span className={`size-2.5 rounded-sm ${FACTOR_COLOR[f.key]}`} /> {f.short}
            </span>
          ))}
        </div>

        <ol className="divide-y divide-slate-100">
          {events.map((e, i) => {
            const active = e.code === detail?.code
            return (
              <li key={e.code}>
                <button
                  onClick={() => setSelected(e.code)}
                  className={`w-full px-4 py-3.5 text-left transition ${active ? 'bg-mint-50/60' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 shrink-0 text-xs font-bold text-slate-400">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm">
                          <span className="font-bold text-navy-900">{e.code}</span>{' '}
                          <span className="text-slate-600">{e.description}</span>
                        </p>
                        <LevelBadge level={e.score.level} score={e.score.residual} />
                      </div>

                      <div data-tour={i === 0 ? "barra" : undefined} className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-label={`Inherente ${e.score.inherent}`}>
                        {e.score.factors.map(f => (
                          <div
                            key={f.key}
                            className={`${FACTOR_COLOR[f.key]} ${f.missing ? 'opacity-40' : ''}`}
                            style={{ width: `${f.contribution}%` }}
                            title={`${f.label}: ${fmtNum(f.contribution)}${f.missing ? ' (dato faltante)' : ''}`}
                          />
                        ))}
                      </div>

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                        <span>Inherente {fmtNum(e.score.inherent)}</span>·
                        <span>controles −{e.score.controls}</span>
                        {e.score.aggravants > 0 && <>· <span className="text-rose-600">agravantes +{e.score.aggravants}</span></>}·
                        <span className="font-semibold text-navy-900">residual {fmtNum(e.score.residual)}</span>
                        {e.score.missingCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 font-semibold text-amber-700">
                            <CircleAlert className="size-3" /> {e.score.missingCount} dato{e.score.missingCount > 1 ? 's' : ''} faltante{e.score.missingCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
        {events.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No hay eventos registrados.</p>}
      </section>

      {/* Detalle */}
      {detail && (
        <aside data-tour="detalle" className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 lg:sticky lg:top-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Detalle</p>
              <h3 className="text-lg font-bold text-navy-900">{detail.code}</h3>
            </div>
            <LevelBadge level={detail.score.level} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{detail.description}</p>
          {canReport && (
            <Link to={`/seguimiento?evento=${detail.code}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-mint-700 hover:underline">
              ¿Un dato está mal? Reportar incidencia <ArrowRight className="size-3" />
            </Link>
          )}

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-slate-50 p-3 text-[11px]">
            <dt className="text-slate-500">Cliente</dt><dd className="text-right font-medium text-navy-900">{detail.clientName}</dd>
            <dt className="text-slate-500">Producto</dt><dd className="text-right font-medium text-navy-900">{detail.product}</dd>
            <dt className="text-slate-500">Canal</dt><dd className="text-right font-medium text-navy-900">{detail.channel}</dd>
            <dt className="text-slate-500">País</dt><dd className="text-right font-medium text-navy-900">{detail.country}</dd>
            {detail.amount && (
              <><dt className="text-slate-500">Monto</dt><dd className="text-right font-medium text-navy-900">{detail.currency} {Number(detail.amount).toLocaleString('en-US')}</dd></>
            )}
          </dl>

          <table data-tour="factores" className="mt-4 w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="py-1.5 text-left font-semibold">Factor</th>
                <th className="py-1.5 text-right font-semibold">Punt.</th>
                <th className="py-1.5 text-right font-semibold">Peso</th>
                <th className="py-1.5 text-right font-semibold">Aporte</th>
              </tr>
            </thead>
            <tbody>
              {detail.score.factors.map(f => (
                <tr key={f.key} className="border-b border-slate-50">
                  <td className="py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`size-2 rounded-sm ${FACTOR_COLOR[f.key]}`} />
                      {f.label}
                      {f.missing && <span className="rounded bg-amber-50 px-1 text-[9px] font-bold text-amber-700" title={`Sin dato: se usa el puntaje conservador de ${methodology.missingScore}`}>FALTANTE</span>}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-medium">{f.score}</td>
                  <td className="py-1.5 text-right text-slate-500">{f.weight} %</td>
                  <td className="py-1.5 text-right font-semibold text-navy-900">{fmtNum(f.contribution)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 font-mono text-[10px] text-slate-400">aporte = peso × puntaje ÷ 5</p>

          <div data-tour="ajustes" className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between font-semibold text-navy-900">
              <span>Riesgo inherente</span><span>{fmtNum(detail.score.inherent)}</span>
            </div>
            {detail.adjustments.map((a, i) => (
              <div key={i} className="flex justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  {a.type === 'CONTROL'
                    ? <ShieldMinus className="size-3.5 shrink-0 text-mint-600" />
                    : <ShieldPlus className="size-3.5 shrink-0 text-rose-600" />}
                  {a.description}
                </span>
                <span className={`font-semibold ${a.type === 'CONTROL' ? 'text-mint-700' : 'text-rose-600'}`}>
                  {a.type === 'CONTROL' ? '−' : '+'}{a.points}
                </span>
              </div>
            ))}
          </div>

          <div data-tour="residual" className={`mt-4 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold text-white ${LEVEL_STYLE[detail.score.level].solid}`}>
            <span>Riesgo residual</span>
            <span>{fmtNum(detail.score.residual)} · {LEVEL_STYLE[detail.score.level].label}</span>
          </div>
        </aside>
      )}
    </div>
  )
}
