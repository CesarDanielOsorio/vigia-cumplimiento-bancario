import { useEffect, useState } from 'react'
import { Check, Loader2, Minus } from 'lucide-react'
import { api, type PermissionsTable as Table } from '../../lib/api'

// Qué puede hacer cada rol en el sistema: viene del backend, que es quien lo hace cumplir.
export default function PermissionsTable({ highlight }: { highlight?: string }) {
  const [data, setData] = useState<Table | null>(null)
  useEffect(() => { api.permissions().then(setData).catch(() => {}) }, [])
  if (!data) return <div className="grid h-32 place-items-center"><Loader2 className="size-6 animate-spin text-mint-500" /></div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-navy-900 text-[11px] text-slate-200">
          <tr>
            <th className="px-3 py-2.5 text-left font-semibold">Acción</th>
            {data.roles.map(r => (
              <th key={r.key} className={`px-2 py-2.5 text-center font-semibold ${highlight === r.key ? 'bg-mint-500/20 text-mint-200' : ''}`}>{r.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.permissions.map(p => (
            <tr key={p.key}>
              <td className="px-3 py-2 text-navy-900">
                {p.label}
                <span className="ml-1.5 font-mono text-[10px] text-slate-400">{p.key}</span>
              </td>
              {data.roles.map(r => (
                <td key={r.key} className={`px-2 py-2 text-center ${highlight === r.key ? 'bg-mint-50/60' : ''}`}>
                  {p.roles.includes(r.key)
                    ? <Check className="mx-auto size-4 text-mint-600" aria-label="Sí" />
                    : <Minus className="mx-auto size-3.5 text-slate-300" aria-label="No" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
