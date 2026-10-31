import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

// Cada pantalla registra su tour; el botón discreto de la barra lateral lo ejecuta.
type TourFn = () => void
const TourContext = createContext<{ tour: TourFn | null; setTour: (fn: TourFn | null) => void } | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const [tour, setTourState] = useState<TourFn | null>(null)
  // useState trata las funciones como "updater", por eso se envuelven.
  const setTour = (fn: TourFn | null) => setTourState(() => fn)
  return <TourContext.Provider value={{ tour, setTour }}>{children}</TourContext.Provider>
}

const useTourContext = () => {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('Falta TourProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTour = () => useTourContext().tour

// eslint-disable-next-line react-refresh/only-export-components
export function useRegisterTour(fn: TourFn | null) {
  const { setTour } = useTourContext()
  useEffect(() => {
    setTour(fn)
    return () => setTour(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn])
}

// Espera a que un elemento exista en pantalla (p. ej. tras cambiar de pestaña).
// eslint-disable-next-line react-refresh/only-export-components
export function waitFor(selector: string, timeout = 3000): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now()
    const check = () => {
      if (document.querySelector(selector) || Date.now() - start > timeout) resolve()
      else requestAnimationFrame(check)
    }
    check()
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export const sel = (name: string) => `[data-tour="${name}"]`

// eslint-disable-next-line react-refresh/only-export-components
export function runTour(steps: DriveStep[]) {
  const d = driver({
    steps,
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Siguiente →',
    prevBtnText: '← Anterior',
    doneBtnText: 'Terminar',
    popoverClass: 'vigia-tour',
    overlayColor: '#050f24',
    overlayOpacity: 0.65,
    stagePadding: 6,
    stageRadius: 12,
    smoothScroll: true,
  })
  d.drive()
  return d
}
