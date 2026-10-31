import type { DriveStep, Driver } from 'driver.js'
import { runTour, sel, waitFor } from '../lib/tour'

type Tab = 'registro' | 'flujo' | 'raci'

// Tour del seguimiento de datos incorrectos: registro, flujo y matriz RACI.
export async function startIncidentsTour({ goTab }: { goTab: (t: Tab) => void }) {
  goTab('registro')
  await waitFor(sel('registro'))

  let d: Driver
  const jump = (tab: Tab, target: string, dir: 'next' | 'prev') => async () => {
    goTab(tab)
    await waitFor(sel(target))
    if (dir === 'next') d.moveNext()
    else d.movePrevious()
  }

  const steps: DriveStep[] = [
    {
      popover: {
        title: 'Seguimiento de incidencias',
        description:
          'Cuando un dato de la matriz está mal (vacío, mal capturado o mal calculado), aquí se le da <b>seguimiento</b> hasta corregirlo, con un responsable en cada paso según la <b>matriz RACI</b> del equipo.<br><br>Te muestro cómo funciona paso a paso.',
      },
    },
    {
      element: sel('estados-inc'),
      popover: {
        title: 'Estados',
        description: 'Cada incidencia avanza: <b>Registrada → Diagnosticada → Corregida → Revalidada → Cerrada</b>. Aquí ves cuántas hay en cada estado.',
        side: 'bottom',
      },
    },
    {
      element: sel('deteccion'),
      popover: {
        title: 'Paso 1 · Detección',
        description: 'La matriz marca solos los eventos con <b>dato faltante</b> (usan el puntaje conservador de 3). El evento no se descarta: se registra la incidencia para completar el dato.',
        side: 'bottom',
      },
    },
    {
      element: sel('registro'),
      popover: {
        title: 'Registro de incidencias',
        description: 'Las mismas columnas de la hoja del equipo: quién <b>detectó</b>, quién <b>corrigió</b>, si hubo <b>impacto en el orden</b>, la <b>versión resultante</b> y quién <b>aprobó</b>. «Días abierta» se pone en rojo si pasa el plazo.',
        side: 'top',
      },
    },
    {
      element: sel('fila-inc'),
      popover: {
        title: 'Cada incidencia',
        description: 'Debajo del estado dice qué <b>sigue</b> y a quién le toca. Haz clic para ver su <b>expediente</b> y, si es tu turno, ejecutar el paso.',
        side: 'bottom',
      },
    },
    {
      element: sel('flujo-tabla'),
      popover: {
        title: 'Flujo del proceso',
        description: 'Los <b>6 pasos</b>: detección, registro, diagnóstico, corrección, revalidación y cierre. Cada uno con su responsable y la <b>evidencia</b> que deja. La última columna cuenta las incidencias que esperan ese paso.',
        side: 'top',
        onNextClick: jump('raci', 'raci-tabla', 'next'),
      },
    },
    {
      element: sel('raci-tabla'),
      popover: {
        title: 'Matriz RACI',
        description: '<b>R</b> ejecuta, <b>A</b> responde, <b>C</b> se consulta, <b>I</b> se informa. La columna de tu rol está resaltada. La validación exige <b>una sola A</b> por actividad; el punto rojo marca las celdas que se ajustaron para cumplirla.',
        side: 'top',
        onPrevClick: jump('flujo', 'flujo-tabla', 'prev'),
      },
    },
    {
      element: sel('reglas'),
      popover: {
        title: 'Reglas clave',
        description: 'Cada regla del RACI tiene un <b>control en el sistema</b> que la hace cumplir. Por ejemplo, quien corrige no puede revalidar ni cerrar: el servidor lo bloquea y lo anota en la bitácora.',
        side: 'top',
      },
    },
  ]

  // Sin datos faltantes o sin incidencias esos pasos no existen; el último paso visible del registro salta al flujo.
  const optional = [sel('deteccion'), sel('fila-inc')]
  const visible = steps.filter(s => !optional.includes(s.element as string) || document.querySelector(s.element as string))
  const flowIdx = visible.findIndex(s => s.element === sel('flujo-tabla'))
  const lastOnRegistro = visible[flowIdx - 1]
  lastOnRegistro.popover = { ...lastOnRegistro.popover, onNextClick: jump('flujo', 'flujo-tabla', 'next') }
  visible[flowIdx].popover = { ...visible[flowIdx].popover, onPrevClick: jump('registro', (lastOnRegistro.element as string).match(/"(.+)"/)![1], 'prev') }

  d = runTour(visible)
}
