import { ShieldCheck } from 'lucide-react'

export default function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-mint-400 to-cyan-400 text-navy-950 shadow-lg shadow-mint-500/20">
        <ShieldCheck className="size-5" strokeWidth={2.4} />
      </div>
      <div className="leading-tight">
        <p className={`text-[15px] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-navy-900'}`}>Vigía</p>
        <p className={`text-[10px] font-medium uppercase tracking-[0.16em] ${dark ? 'text-mint-300/80' : 'text-mint-700'}`}>
          Cumplimiento Bancario
        </p>
      </div>
    </div>
  )
}
