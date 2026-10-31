import type { DriveStep, Driver } from 'driver.js'
import { runTour, sel, waitFor } from '../lib/tour'

type Tab = 'usuarios' | 'permisos' | 'parametros'

// Tour del panel de configuración (solo administrador).
export async function startSettingsTour({ goTab }: { goTab: (t: Tab) => void }) {
  goTab('usuarios')
  await waitFor(sel('usuarios'))

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
        title: 'Configuración del sistema',
        description: 'Aquí el administrador gestiona <b>usuarios, roles y parámetros de seguridad</b>. Cada cambio queda en la bitácora de auditoría con su usuario.',
      },
    },
    {
      element: sel('usuarios'),
      popover: {
        title: 'Usuarios y roles',
        description: 'Cambias el rol, desbloqueas cuentas, restableces contraseñas o desactivas usuarios. No puedes cambiar <b>tu propio rol</b> ni desactivarte, y siempre debe quedar <b>un administrador activo</b>.',
        side: 'top',
      },
    },
    {
      element: sel('nuevo-usuario'),
      popover: {
        title: 'Nuevo usuario',
        description: 'El sistema genera una <b>contraseña temporal fuerte</b> que se muestra una sola vez. En la base de datos solo se guarda su hash bcrypt.',
        side: 'left',
        onNextClick: jump('permisos', 'permisos', 'next'),
      },
    },
    {
      element: sel('permisos'),
      popover: {
        title: 'Permisos por rol',
        description: 'Qué permite el servidor a cada rol (<b>mínimo privilegio</b>). El administrador ve todo y ejecuta tareas operativas, pero las <b>aprobaciones son del Auditor/QA</b>: nadie aprueba lo que propuso.',
        side: 'top',
        onPrevClick: jump('usuarios', 'nuevo-usuario', 'prev'),
        onNextClick: jump('parametros', 'param-seguridad', 'next'),
      },
    },
    {
      element: sel('param-seguridad'),
      popover: {
        title: 'Seguridad de acceso',
        description: 'Duración de la sesión, intentos fallidos antes de bloquear y duración del bloqueo. Cada valor tiene un <b>rango permitido</b> para no dejar el sistema inseguro.',
        side: 'right',
        onPrevClick: jump('permisos', 'permisos', 'prev'),
      },
    },
    {
      element: sel('param-operacion'),
      popover: {
        title: 'Operación',
        description: 'Cuándo se consideran <b>desactualizadas las listas</b> y el <b>plazo para cerrar incidencias</b> (las que lo pasan se marcan en rojo en el seguimiento).',
        side: 'left',
      },
    },
    {
      element: sel('param-matriz'),
      popover: {
        title: 'Parámetros de la matriz',
        description: 'Solo lectura: los pesos, los niveles y la regla de dato faltante se cambian con una <b>versión nueva</b> que aprueba el Auditor/QA, no desde aquí.',
        side: 'top',
      },
    },
  ]
  d = runTour(steps)
}
