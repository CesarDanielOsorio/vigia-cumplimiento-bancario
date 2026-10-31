import type { FactorDef, Weights } from '../../lib/api'
import { FACTOR_COLOR, sumWeights } from './ui'

interface Props {
  factors: FactorDef[]
  value: Weights
  onChange?: (w: Weights) => void
  compareTo?: Weights // resalta los pesos que cambian
}

export default function WeightEditor({ factors, value, onChange, compareTo }: Props) {
  const total = sumWeights(value)

  return (
    <div className="space-y-2.5">
      {factors.map(f => {
        const w = value[f.key]
        const changed = compareTo && compareTo[f.key] !== w
        return (
          <div key={f.key} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-navy-900">
              <span className={`size-2.5 shrink-0 rounded-sm ${FACTOR_COLOR[f.key]}`} />
              {f.label}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${FACTOR_COLOR[f.key]}`} style={{ width: `${Math.min(w, 100)}%` }} />
            </div>
            {onChange ? (
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={w}
                  onChange={e => onChange({ ...value, [f.key]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
                  className={`w-full rounded-md border py-1 pl-2 pr-6 text-right text-xs font-semibold outline-none focus:ring-2 focus:ring-mint-500/30 ${
                    changed ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-navy-900'
                  }`}
                  aria-label={`Peso de ${f.label}`}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
              </div>
            ) : (
              <span className="text-right text-xs font-semibold text-navy-900">{w} %</span>
            )}
          </div>
        )
      })}
      <div className={`flex justify-between border-t border-slate-100 pt-2 text-xs font-bold ${total === 100 ? 'text-mint-700' : 'text-rose-600'}`}>
        <span>SUMA</span>
        <span>{total} %{total !== 100 && ' — debe ser 100 %'}</span>
      </div>
    </div>
  )
}
