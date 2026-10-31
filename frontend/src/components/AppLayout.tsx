import { NavLink, Outlet } from 'react-router-dom'
import { CircleHelp, FolderSearch, Gauge, Globe2, LogOut, ScrollText, Settings, type LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import type { Permission } from '../lib/api'
import Brand from './Brand'
import { useTour } from '../lib/tour'

interface NavItem { to: string; label: string; icon: LucideIcon; perm?: Permission }

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Cumplimiento',
    items: [
      { to: '/listas-internacionales', label: 'Listas Internacionales', icon: Globe2 },
      { to: '/matriz', label: 'Matriz LA/FT', icon: Gauge },
      { to: '/seguimiento', label: 'Seguimiento de incidencias', icon: FolderSearch },
    ],
  },
  {
    section: 'Administración',
    items: [
      { to: '/bitacora', label: 'Bitácora de auditoría', icon: ScrollText, perm: 'audit.view' },
      { to: '/configuracion', label: 'Configuración', icon: Settings, perm: 'system.manage' },
    ],
  },
]

export default function AppLayout() {
  const { user, logout, can } = useAuth()
  const tour = useTour()
  if (!user) return null
  const initials = user.fullName.split(' ').map(w => w[0]).slice(0, 2).join('')
  const sections = NAV.map(s => ({ ...s, items: s.items.filter(i => !i.perm || can(i.perm)) })).filter(s => s.items.length)

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="tech-grid flex shrink-0 flex-col bg-navy-950 lg:sticky lg:top-0 lg:h-screen lg:w-64">
        <div className="flex items-center justify-between px-5 py-5">
          <Brand dark />
          <div className="flex items-center gap-1 lg:hidden">
            {tour && (
              <button onClick={tour} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Tour guiado: cómo funciona esta pantalla">
                <CircleHelp className="size-4" />
              </button>
            )}
            <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar sesión">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:pb-0">
          {sections.map(s => (
            <div key={s.section} className="contents lg:block">
              <p className="hidden px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:block">{s.section}</p>
              {s.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition lg:mb-1 ${
                      isActive
                        ? 'bg-mint-400/10 text-mint-300 ring-1 ring-inset ring-mint-400/25'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {tour && (
          <button
            onClick={tour}
            className="mx-3 mb-2 hidden items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 transition hover:bg-white/5 hover:text-mint-300 lg:flex"
            title="Tour guiado: cómo funciona esta pantalla"
          >
            <CircleHelp className="size-3.5" /> ¿Cómo funciona?
          </button>
        )}

        <div className="hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-600 to-mint-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-mint-400/80" title={user.roleLabel}>{user.roleLabel}</p>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
