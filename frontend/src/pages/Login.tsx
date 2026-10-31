import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Eye, EyeOff, FileClock, Fingerprint, Loader2, Lock, ScanSearch, User } from 'lucide-react'
import { useAuth } from '../lib/auth'
import Brand from '../components/Brand'
import SecurityIllustration from '../components/SecurityIllustration'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/listas-internacionales', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Mitad izquierda: imagen de seguridad bancaria */}
      <aside className="tech-grid relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-10 lg:flex">
        <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-mint-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 size-[28rem] rounded-full bg-cyan-500/15 blur-3xl" />

        <Brand dark />

        <div className="relative mx-auto w-full max-w-lg">
          <SecurityIllustration className="w-full" />

          <div className="animate-float absolute left-0 top-10 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-md">
            <ScanSearch className="size-4 text-mint-400" />
            <div>
              <p className="text-[11px] font-semibold text-white">Tamizaje OFAC · ONU · UE</p>
              <p className="text-[10px] text-mint-300/80">0 coincidencias</p>
            </div>
          </div>
          <div className="animate-float-delayed absolute right-0 top-1/2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-md">
            <Fingerprint className="size-4 text-cyan-300" />
            <div>
              <p className="text-[11px] font-semibold text-white">Sesión cifrada</p>
              <p className="text-[10px] text-cyan-200/80">Cookie httpOnly · JWT</p>
            </div>
          </div>
          <div className="animate-float absolute bottom-6 left-6 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 backdrop-blur-md">
            <FileClock className="size-4 text-mint-400" />
            <div>
              <p className="text-[11px] font-semibold text-white">Bitácora de auditoría</p>
              <p className="text-[10px] text-mint-300/80">Cada acceso queda registrado</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-2xl font-bold leading-snug text-white">
            Seguridad bancaria con <span className="bg-gradient-to-r from-mint-300 to-cyan-300 bg-clip-text text-transparent">inteligencia de cumplimiento</span>
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Tamizaje contra listas de sanciones internacionales, PEPs y personas buscadas, alineado con el Decreto 15-2026 contra el LD/FT.
          </p>
        </div>
      </aside>

      {/* Mitad derecha: formulario */}
      <main className="flex flex-col bg-white px-6 py-10 sm:px-12">
        <div className="lg:hidden">
          <Brand />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mint-600">Acceso seguro</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-slate-500">Ingresa con tus credenciales para acceder al módulo de cumplimiento.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-navy-900">Usuario</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  required
                  maxLength={50}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-mint-500 focus:bg-white focus:ring-4 focus:ring-mint-500/15"
                  placeholder="tu.usuario"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-navy-900">Contraseña</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-mint-500 focus:bg-white focus:ring-4 focus:ring-mint-500/15"
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-navy-700"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 py-2.5 text-sm font-semibold text-white shadow-lg shadow-navy-900/20 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Ingresar <ArrowRight className="size-4 text-mint-400 transition group-hover:translate-x-0.5" /></>}
            </button>
          </form>

          <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Lock className="size-3.5 text-mint-600" />
            Por seguridad, la cuenta se bloquea 15 minutos tras 5 intentos fallidos.
          </p>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Proyecto académico · Seguridad y Auditoría de Sistemas — Cesar Daniel Osorio Polanco
        </p>
      </main>
    </div>
  )
}
