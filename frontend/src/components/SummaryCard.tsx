import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  value: ReactNode
  label: string
  footer?: ReactNode
  highlight?: boolean
}

export default function SummaryCard({ icon: Icon, value, label, footer, highlight }: Props) {
  if (highlight) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-5 text-white shadow-lg shadow-navy-900/20">
        <div className="tech-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-mint-400/20 blur-2xl" />
        <Icon className="relative size-5 text-mint-300" />
        <p className="relative mt-3 text-3xl font-extrabold tracking-tight">{value}</p>
        <p className="relative mt-1 text-[11px] font-semibold uppercase tracking-wider text-mint-100/80">{label}</p>
        {footer && <div className="relative mt-2">{footer}</div>}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <Icon className="size-5 text-slate-400" />
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  )
}
