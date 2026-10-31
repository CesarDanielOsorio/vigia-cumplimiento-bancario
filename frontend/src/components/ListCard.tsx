import { Link } from 'react-router-dom'
import { Ban, CircleCheck, CircleX, ExternalLink, Eye, Globe, RefreshCw, TriangleAlert, Users } from 'lucide-react'
import type { ListInfo } from '../lib/api'
import { fmt, timeAgo } from '../lib/timeAgo'

const ICONS = { ban: Ban, users: Users, globe: Globe, alert: TriangleAlert }
const COLORS = {
  amber: 'bg-amber-100 text-amber-600',
  violet: 'bg-violet-100 text-violet-600',
  sky: 'bg-sky-100 text-sky-600',
  rose: 'bg-rose-100 text-rose-600',
}

interface Props {
  list: ListInfo
  canSync: boolean
  tourAnchors?: boolean // marca esta tarjeta como ejemplo del tour guiado
  onSync: () => void
}

export default function ListCard({ list, canSync, onSync, tourAnchors }: Props) {
  const tour = (name: string) => (tourAnchors ? name : undefined)
  const Icon = ICONS[list.icon]
  const running = list.syncStatus === 'running'

  return (
    <article data-tour={tour('tarjeta')} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:border-mint-300 hover:shadow-lg hover:shadow-navy-900/5">
      <div className="flex items-start justify-between">
        <div className={`grid size-10 place-items-center rounded-xl ${COLORS[list.color]}`}>
          <Icon className="size-5" />
        </div>
        {list.active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-mint-50 px-2 py-0.5 text-[10px] font-semibold text-mint-700 ring-1 ring-inset ring-mint-200">
            <CircleCheck className="size-3" /> Activa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            <CircleX className="size-3" /> Inactiva
          </span>
        )}
      </div>

      <h3 className="mt-4 font-semibold text-navy-900">{list.name}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{list.description}</p>

      <div data-tour={tour('metricas')} className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Registros</p>
          <p className="mt-0.5 text-lg font-bold text-navy-900">{fmt(list.recordCount)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Última sync</p>
          <p className="mt-0.5 text-sm font-semibold text-navy-900">{timeAgo(list.lastSyncAt)}</p>
        </div>
      </div>

      {list.syncStatus === 'error' && list.syncError && (
        <p className="mt-2 text-[11px] text-rose-600">Error en la última sincronización: {list.syncError}</p>
      )}

      <div data-tour={tour('acciones')} className="mt-4 grid grid-cols-2 gap-2.5">
        <Link
          to={`/listas-internacionales/${list.key}`}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-navy-800 transition hover:border-mint-500 hover:text-mint-700"
        >
          <Eye className="size-4" /> Ver registros
        </Link>
        <button
          onClick={onSync}
          disabled={!canSync || running}
          title={canSync ? undefined : 'Solo los administradores pueden sincronizar'}
          className="flex items-center justify-center gap-2 rounded-lg bg-navy-900 py-2 text-sm font-medium text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`size-4 text-mint-400 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Sincronizando...' : 'Re-sincronizar'}
        </button>
      </div>

      {list.sources.length > 0 && (
        <div data-tour={tour('fuentes')} className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fuentes oficiales</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {list.sources.map(s => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-mint-700 hover:text-mint-600 hover:underline"
              >
                {s.label} <ExternalLink className="size-3" />
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
