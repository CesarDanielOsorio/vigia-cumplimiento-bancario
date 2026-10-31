import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Clock, Database, Globe, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { api, type ListKey, type ListsResponse } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fmt, timeAgo } from '../lib/timeAgo'
import SummaryCard from '../components/SummaryCard'
import ListCard from '../components/ListCard'
import { useRegisterTour } from '../lib/tour'
import { startListsTour } from '../tours/listsTour'

const POLL_MS = 5000

export default function InternationalLists() {
  const { can } = useAuth()
  const canSync = can('lists.sync')
  const [data, setData] = useState<ListsResponse | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await api.lists())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las listas')
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Mientras alguna lista esté sincronizando se consulta cada 5 s.
  const tourFn = useCallback(() => startListsTour({ canSync }), [canSync])
  useRegisterTour(data ? tourFn : null)

  const anyRunning = data?.lists.some(l => l.syncStatus === 'running') ?? false
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [anyRunning, load])

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la sincronización')
    }
    await load()
  }

  const syncAll = () => run(api.syncAll)
  const syncOne = (key: ListKey) => run(() => api.syncList(key))

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint-600">Cumplimiento · Listas restrictivas</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Listas Restrictivas Internacionales</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Sanciones (OFAC, ONU, UE, UK), PEPs, empresas inhabilitadas y personas buscadas — fuentes oficiales agregadas vía{' '}
            <a href="https://www.opensanctions.org" target="_blank" rel="noopener noreferrer" className="font-medium text-mint-700 hover:underline">OpenSanctions</a>.
          </p>
        </div>
        <button
          data-tour="sincronizar"
          onClick={syncAll}
          disabled={!canSync || anyRunning}
          title={canSync ? undefined : 'Solo los administradores pueden sincronizar'}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-mint-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-navy-950 shadow-lg shadow-mint-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${anyRunning ? 'animate-spin' : ''}`} />
          {anyRunning ? 'Sincronizando...' : 'Sincronizar todas'}
        </button>
      </header>

      {error && (
        <div role="alert" className="mt-5 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {!data ? (
        !error && (
          <div className="grid h-64 place-items-center">
            <Loader2 className="size-7 animate-spin text-mint-500" />
          </div>
        )
      ) : (
        <>
          <section data-tour="resumen" className="mt-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard highlight icon={Database} value={fmt(data.summary.totalRecords)} label="Total registros indexados" />
            <SummaryCard
              icon={Clock}
              value={timeAgo(data.summary.lastSyncAt)}
              label="Última actualización"
              footer={
                data.summary.isStale && (
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <TriangleAlert className="size-3.5" /> Datos con &gt;48h sin sync
                  </p>
                )
              }
            />
            <SummaryCard icon={Globe} value={data.summary.activeLists} label="Listas activas" />
          </section>

          <section className="mt-6 grid gap-5 md:grid-cols-2">
            {data.lists.map(l => (
              <ListCard key={l.key} list={l} canSync={canSync} onSync={() => syncOne(l.key)} tourAnchors={l.key === 'debarment'} />
            ))}
          </section>

          <p data-tour="licencia" className="mt-6 text-center text-[11px] text-slate-400">
            Datos de OpenSanctions bajo licencia CC BY-NC 4.0 — uso académico no comercial.
          </p>
        </>
      )}
    </div>
  )
}
