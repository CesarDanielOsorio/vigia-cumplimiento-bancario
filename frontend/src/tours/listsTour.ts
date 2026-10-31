import type { DriveStep } from 'driver.js'
import { runTour, sel } from '../lib/tour'

// Tour que explica cómo funciona el módulo de listas restrictivas.
export function startListsTour({ canSync }: { canSync: boolean }) {
  const steps: DriveStep[] = [
    {
      popover: {
        title: 'Listas Restrictivas Internacionales',
        description:
          'Este módulo descarga y guarda en la base de datos las listas oficiales de riesgo: <b>sanciones</b>, <b>PEPs</b>, <b>empresas inhabilitadas</b> y <b>personas buscadas</b>. Sirven para verificar si un cliente aparece en alguna antes de operar con él.<br><br>Te muestro cómo funciona.',
      },
    },
    {
      element: sel('resumen'),
      popover: {
        title: 'Resumen general',
        description: 'Total de registros guardados, hace cuánto se actualizaron los datos y cuántas listas están activas. Si pasan más de <b>48 horas</b> sin sincronizar, aparece una alerta: con datos viejos podría pasarse por alto a alguien recién sancionado.',
        side: 'bottom',
      },
    },
    {
      element: sel('tarjeta'),
      popover: {
        title: 'Cada lista',
        description: 'Hay una tarjeta por lista. Todas se obtienen de <b>OpenSanctions</b>, que reúne fuentes oficiales (OFAC, ONU, UE, Reino Unido, Banco Mundial, FBI y muchas más) en un formato uniforme.',
        side: 'right',
      },
    },
    {
      element: sel('metricas'),
      popover: {
        title: 'Registros y última sincronización',
        description: 'Cuántas personas o empresas tiene la lista y cuándo se descargó por última vez.',
        side: 'bottom',
      },
    },
    {
      element: sel('acciones'),
      popover: {
        title: 'Consultar y actualizar',
        description:
          '<b>Ver registros</b> abre un buscador por nombre o alias: ignora tildes, puntos y comas, así «Panamá, S.A.» encuentra «PANAMA SA».<br><br><b>Re-sincronizar</b> descarga la versión más reciente de la lista. ' +
          (canSync
            ? 'Si la descarga falla, se conservan los datos anteriores.'
            : 'Solo el <b>administrador</b> puede sincronizar (control de acceso por roles).'),
        side: 'top',
      },
    },
    {
      element: sel('fuentes'),
      popover: {
        title: 'Fuentes oficiales',
        description: 'Enlaces a las páginas oficiales de donde provienen los datos, para poder verificarlos.',
        side: 'top',
      },
    },
    {
      element: sel('sincronizar'),
      popover: {
        title: 'Sincronizar todas',
        description:
          'Actualiza las 4 listas una tras otra. Tarda varios minutos porque descarga cientos de MB.' +
          (canSync ? '' : ' Este botón solo funciona para el <b>administrador</b>.') +
          '<br><br>Cada sincronización y cada búsqueda queda registrada en la <b>bitácora de auditoría</b>.',
        side: 'left',
      },
    },
    {
      element: sel('licencia'),
      popover: {
        title: 'Uso de los datos',
        description: 'Los datos de OpenSanctions son gratuitos para uso <b>no comercial</b> (licencia CC BY-NC 4.0), como este proyecto académico; por eso se cita la fuente.',
        side: 'top',
      },
    },
  ]
  runTour(steps)
}
