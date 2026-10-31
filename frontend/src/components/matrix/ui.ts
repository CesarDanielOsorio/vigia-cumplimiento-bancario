import type { FactorKey, LevelKey, Weights } from '../../lib/api'

export const LEVEL_STYLE: Record<LevelKey, { label: string; badge: string; solid: string; text: string }> = {
  BAJO: { label: 'BAJO', badge: 'bg-mint-50 text-mint-700 ring-mint-200', solid: 'bg-mint-500', text: 'text-mint-700' },
  MEDIO: { label: 'MEDIO', badge: 'bg-amber-50 text-amber-700 ring-amber-200', solid: 'bg-amber-400', text: 'text-amber-700' },
  ALTO: { label: 'ALTO', badge: 'bg-orange-50 text-orange-700 ring-orange-200', solid: 'bg-orange-500', text: 'text-orange-700' },
  CRITICO: { label: 'CRÍTICO', badge: 'bg-rose-50 text-rose-700 ring-rose-200', solid: 'bg-rose-600', text: 'text-rose-700' },
}

// Un color por factor, igual en barras, leyenda y tablas.
export const FACTOR_COLOR: Record<FactorKey, string> = {
  monto: 'bg-amber-500',
  frecuencia: 'bg-orange-400',
  producto: 'bg-violet-500',
  canal: 'bg-sky-500',
  jurisdiccion: 'bg-teal-500',
  perfil: 'bg-indigo-500',
  pep: 'bg-rose-500',
}

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const sumWeights = (w: Weights) => Object.values(w).reduce((s, v) => s + v, 0)
