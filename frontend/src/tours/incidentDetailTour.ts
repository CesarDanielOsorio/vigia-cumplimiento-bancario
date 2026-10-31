import type { DriveStep } from 'driver.js'
import { runTour, sel } from '../lib/tour'

// Tour del expediente de una incidencia. Solo incluye los pasos cuyos elementos están en pantalla.
export function startIncidentDetailTour() {
  const steps: DriveStep[] = [
    {
      element: sel('pasos-inc'),
      popover: {
        title: 'Dónde va la incidencia',
        description: 'Los 6 pasos del flujo. Los verdes ya se hicieron y el resaltado es el que <b>sigue</b>, con su responsable debajo.',
        side: 'bottom',
      },
    },
    {
      element: sel('datos-inc'),
      popover: {
        title: 'Registro',
        description: 'Qué falló, en qué evento y factor, quién lo detectó y cómo estaba el evento <b>al detectarlo</b>: su residual y su lugar en el ranking. Esa foto sirve para medir el impacto.',
        side: 'right',
      },
    },
    {
      element: sel('revalidacion'),
      popover: {
        title: 'El score se reproduce',
        description: 'El puntaje recalculado <b>factor por factor</b> (<code>peso × puntaje ÷ 5</code>), con la suma completa. Abajo se compara el <b>orden de atención</b> al detectar y después de corregir: si cambió, hay impacto.',
        side: 'right',
      },
    },
    {
      element: sel('expediente-inc'),
      popover: {
        title: 'Expediente',
        description: 'Cada paso con <b>quién, cuándo y qué</b>. No se edita ni se borra: es la evidencia que revisa el Auditor/QA.',
        side: 'right',
      },
    },
    {
      element: sel('accion-inc'),
      popover: {
        title: 'Siguiente paso',
        description: 'Qué toca ahora y quién lo hace. El recuadro <b>RACI</b> muestra el papel de cada rol en esta actividad. Si es tu turno, aquí aparece el formulario; si no, solo consultas.<br><br><b>Quien corrige no valida:</b> el sistema no te deja revalidar ni cerrar tu propia corrección.',
        side: 'left',
      },
    },
  ]
  runTour(steps.filter(s => !s.element || document.querySelector(s.element as string)))
}
