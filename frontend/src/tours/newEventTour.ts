import { runTour, sel } from '../lib/tour'

// Tour que explica cómo registrar un evento en la matriz LA/FT.
export function startNewEventTour() {
  runTour([
    {
      popover: {
        title: 'Registrar un evento',
        description:
          'Aquí se registra una <b>señal de riesgo</b> (evento) para que la matriz le calcule su puntaje y la ubique en el ranking.<br><br>Son <b>3 pasos</b>: describir el evento, calificar los factores y agregar controles o agravantes. Usa solo datos ficticios.',
      },
    },
    {
      element: sel('evento'),
      popover: {
        title: '1 · Datos del evento',
        description: 'Describe <b>qué pasó</b> (la señal), el producto, el canal, el país y el monto. Estos datos dan contexto al analista, pero <b>no cambian el puntaje</b>: el puntaje sale de los factores del paso 2.',
        side: 'right',
      },
    },
    {
      element: sel('cliente'),
      popover: {
        title: 'Verificar en listas',
        description: 'Con este botón, el nombre del cliente se busca en las <b>listas restrictivas internacionales</b> (sanciones, PEPs, buscados). Si hay coincidencias, te sirve para calificar el factor <b>PEP / Sanciones</b>.',
        side: 'bottom',
      },
    },
    {
      element: sel('factores-form'),
      popover: {
        title: '2 · Calificar los 7 factores',
        description: 'Cada factor se califica de <b>0</b> (sin riesgo) a <b>5</b> (riesgo máximo). Debajo de cada uno aparece qué significa el número elegido, según el diccionario de factores, para que todos califiquen igual.',
        side: 'right',
      },
    },
    {
      element: sel('factor-ejemplo'),
      popover: {
        title: 'Ejemplo: Monto (peso 20 %)',
        description: 'Elige un número y mira cómo cambia la vista previa. Si no conoces el dato, deja <b>«Sin dato»</b>: se usa el puntaje conservador <b>3</b> y el evento queda marcado como dato faltante. Nunca se descarta por falta de información.',
        side: 'bottom',
      },
    },
    {
      element: sel('ajustes-form'),
      popover: {
        title: '3 · Controles y agravantes',
        description: 'Selecciona los <b>controles</b> que ya se aplicaron (en verde, <b>restan</b> puntos) y los <b>agravantes</b> detectados (en rojo, <b>suman</b> puntos). Un clic los activa y otro los quita.',
        side: 'right',
      },
    },
    {
      element: sel('ajuste-otro'),
      popover: {
        title: 'Agregar uno propio',
        description: 'Si el control o agravante no está en el catálogo, escríbelo aquí con sus puntos (de 1 a 20) y presiona <b>+</b>.',
        side: 'top',
      },
    },
    {
      element: sel('vista-previa'),
      popover: {
        title: 'Vista previa en vivo',
        description: 'Se recalcula con cada cambio:<br><code>inherente = Σ peso × puntaje ÷ 5</code><br><code>residual = inherente − controles + agravantes</code><br>y muestra el <b>nivel</b> que tendrá el evento. Al guardar, el servidor vuelve a calcular con la versión vigente.',
        side: 'left',
      },
    },
    {
      element: sel('guardar'),
      popover: {
        title: 'Guardar',
        description: 'El evento recibe un código (EV-007, EV-008…) y aparece en el <b>ranking</b> según su riesgo residual, no al final. El registro queda en la <b>bitácora de auditoría</b> con tu usuario y la hora.',
        side: 'left',
      },
    },
  ])
}
