import { runTour, sel } from '../lib/tour'

// Tour de la bitácora de auditoría.
export function startAuditTour() {
  runTour([
    {
      popover: {
        title: 'Bitácora de auditoría',
        description: 'Es la <b>evidencia</b> de todo lo que pasa en el sistema: quién hizo qué, cuándo y desde qué IP. Solo la consultan el administrador y el Auditor/QA, y nadie la edita.',
      },
    },
    {
      element: sel('filtros-bitacora'),
      popover: {
        title: 'Filtrar',
        description: 'Busca por usuario o por texto del detalle (por ejemplo <b>INC-002</b> o <b>v1.2</b>), o elige un tipo de acción.',
        side: 'bottom',
      },
    },
    {
      element: sel('tabla-bitacora'),
      popover: {
        title: 'Registros',
        description: 'Del más reciente al más antiguo. En <b>rojo</b> van los que un auditor revisa primero: intentos fallidos, cuentas bloqueadas y los intentos que la <b>segregación de funciones</b> bloqueó.',
        side: 'top',
      },
    },
    {
      element: sel('permisos-bitacora'),
      popover: {
        title: 'Permisos por rol',
        description: 'Para contrastar: si en la bitácora aparece una acción, aquí ves qué roles podían hacerla.',
        side: 'top',
      },
    },
  ])
}
