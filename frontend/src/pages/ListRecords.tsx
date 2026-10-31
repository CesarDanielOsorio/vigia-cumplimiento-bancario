import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { api, type RecordsResponse } from '../lib/api'
import { fmt } from '../lib/timeAgo'

const SCHEMA_LABEL: Record<string, string> = {
  Person: 'Persona',
  Company: 'Empresa',
  Organization: 'Organización',
  LegalEntity: 'Entidad legal',
  Vessel: 'Embarcación',
  Airplane: 'Aeronave',
}

export default function ListRecords() {
  const { key = '' } = useParams()
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RecordsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Debounce de 300 ms para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.records(key, q, page)
      .then(r => { if (!cancelled) { setData(r); setError('') } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar registros') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [key, q, page])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div>
      <Link to="/listas-internacionales" className="inline-flex items-center gap-1.5 text-xs font-medium text-mint-700 hover:underline">
        <ArrowLeft className="size-3.5" /> Volver a Listas Internacionales
      </Link>

      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{data?.list.name ?? 'Registros'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `${fmt(data.total)} ${q ? 'coincidencias' : 'registros'}` : 'Cargando...'}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            maxLength={100}
            placeholder="Buscar por nombre o alias..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-mint-500 focus:ring-4 focus:ring-mint-500/15"
          />
        </div>
      </header>

      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="relative mt-5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/60">
            <Loader2 className="size-6 animate-spin text-mint-500" />
          </div>
        )}
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-navy-900 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Países</th>
              <th className="px-4 py-3 font-semibold">Nacimiento</th>
              <th className="px-4 py-3 font-semibold">Dataset</th>
              <th className="px-4 py-3 font-semibold">Alias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.records.map(r => (
              <tr key={r.id} className="hover:bg-mint-50/50">
                <td className="px-4 py-3 font-medium text-navy-900">{r.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{SCHEMA_LABEL[r.schema] ?? r.schema}</span>
                </td>
                <td className="px-4 py-3 text-xs uppercase text-slate-600">{r.countries.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{r.birthDate || '—'}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{r.dataset}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {r.aliases.length === 0 ? '—' : (
                    <>
                      {r.aliases.slice(0, 2).join(' · ')}
                      {r.aliases.length > 2 && <span className="ml-1 rounded bg-mint-50 px-1 text-[10px] font-semibold text-mint-700">+{r.aliases.length - 2}</span>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {data && data.records.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                  {q ? 'Sin coincidencias para esa búsqueda.' : 'Esta lista aún no tiene registros. Sincronízala para descargarlos.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <p className="text-slate-500">Página {page} de {fmt(totalPages)}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-navy-800 hover:border-mint-500 disabled:opacity-50"
          >
            <ChevronLeft className="size-4" /> Anterior
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-navy-800 hover:border-mint-500 disabled:opacity-50"
          >
            Siguiente <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
