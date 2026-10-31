import type { DriveStep, Driver } from 'driver.js'
import { runTour, sel, waitFor } from '../lib/tour'

type Tab = 'tablero' | 'ponderaciones' | 'sensibilidad' | 'metodologia'

interface Options {
  goTab: (tab: Tab) => void
  canCreate: boolean
}

// Tour que explica cómo funciona la matriz, recorriendo sus 4 pestañas.
export async function startMatrixTour({ goTab, canCreate }: Options) {
  goTab('tablero')
  await waitFor(sel('ranking'))

  let d: Driver
  // Cambia de pestaña y avanza/retrocede cuando el elemento destino ya está en pantalla.
  const jump = (tab: Tab, target: string, dir: 'next' | 'prev') => async () => {
    goTab(tab)
    await waitFor(sel(target))
    if (dir === 'next') d.moveNext()
    else d.movePrevious()
  }

  const steps: DriveStep[] = [
    {
      popover: {
        title: 'Matriz de priorización LA/FT',
        description:
          'Esta herramienta recibe <b>eventos</b> (señales de posible lavado de activos), les calcula un <b>puntaje de riesgo de 0 a 100</b> con una fórmula fija y los <b>ordena</b> para saber cuál revisar primero.<br><br>Te muestro cómo funciona paso a paso.',
      },
    },
    {
      element: sel('regla'),
      popover: {
        title: 'Regla de oro',
        description: 'La matriz <b>ordena la atención</b>, no decide. Escalar o reportar a la IVE siempre lo decide el especialista. Todos los datos son sintéticos.',
        side: 'bottom',
      },
    },
    {
      element: sel('niveles'),
      popover: {
        title: 'Niveles de riesgo',
        description: 'Según el puntaje <b>residual</b>, cada evento cae en un nivel: <b>Bajo</b> 0–24, <b>Medio</b> 25–49, <b>Alto</b> 50–74 y <b>Crítico</b> 75–100. Aquí ves cuántos eventos hay en cada uno.',
        side: 'bottom',
      },
    },
    {
      element: sel('version'),
      popover: {
        title: 'Versión de parámetros',
        description: 'Los cálculos usan los pesos de la <b>versión aprobada vigente</b>. Si alguien cambia los pesos, se crea una versión nueva y queda registro.',
        side: 'left',
      },
    },
    {
      element: sel('ranking'),
      popover: {
        title: 'Ranking de atención',
        description: 'Los eventos están ordenados de <b>mayor a menor riesgo residual</b>. El primero es el que el analista debe revisar antes. Un evento nuevo se ubica según su puntaje, no por fecha.',
        side: 'right',
      },
    },
    {
      element: sel('barra'),
      popover: {
        title: 'De dónde sale el puntaje',
        description: 'Cada color es uno de los <b>7 factores</b>: monto, frecuencia, producto, canal, jurisdicción, perfil y PEP/sanciones. El ancho de cada color es cuánto aporta ese factor al riesgo.',
        side: 'bottom',
      },
    },
    {
      element: sel('factores'),
      popover: {
        title: 'Paso 1 · Aporte de cada factor',
        description: 'Cada factor se califica de <b>0 a 5</b> y tiene un peso. Su aporte es <code>peso × puntaje ÷ 5</code>.<br>Ej.: Jurisdicción 20 % con puntaje 5 → 20 × 5 ÷ 5 = <b>20</b>.<br><br>Si falta un dato se usa <b>3</b> (conservador) y se marca «FALTANTE».',
        side: 'left',
      },
    },
    {
      element: sel('ajustes'),
      popover: {
        title: 'Paso 2 · Inherente y ajustes',
        description: 'La suma de los 7 aportes es el <b>riesgo inherente</b>. Luego los <b>controles</b> del banco restan puntos (verde) y los <b>agravantes</b> suman (rojo).',
        side: 'left',
      },
    },
    {
      element: sel('residual'),
      popover: {
        title: 'Paso 3 · Riesgo residual',
        description: '<code>residual = inherente − controles + agravantes</code><br>Este número define el nivel y el lugar en el ranking. Cualquiera puede recalcularlo a mano con la tabla de arriba.',
        side: 'left',
        onNextClick: jump('ponderaciones', 'pesos', 'next'),
      },
    },
    {
      element: sel('pesos'),
      popover: {
        title: 'Ponderaciones vigentes',
        description: 'Aquí están los <b>pesos</b> de cada factor. Siempre deben <b>sumar 100 %</b>. Monto y jurisdicción pesan más porque son los indicadores más fuertes de lavado.',
        side: 'right',
        onPrevClick: jump('tablero', 'residual', 'prev'),
      },
    },
    {
      element: sel('proponer'),
      popover: {
        title: 'Proponer un cambio',
        description: 'Los pesos no se editan directamente: se <b>propone</b> una versión nueva con su motivo y queda <b>pendiente de aprobación</b>.',
        side: 'top',
      },
    },
    {
      element: sel('cambios'),
      popover: {
        title: 'Control de cambios',
        description: 'Cada versión guarda <b>quién</b> la propuso, <b>cuándo</b>, <b>por qué</b> y <b>quién la aprobó</b>.<br><br><b>Segregación de funciones:</b> según el RACI, propone el analista de datos o el líder y aprueba solo el <b>Auditor/QA</b>; nadie aprueba su propia propuesta. Todo queda en la bitácora.',
        side: 'left',
        onNextClick: jump('sensibilidad', 'escenario', 'next'),
      },
    },
    {
      element: sel('escenario'),
      popover: {
        title: 'Prueba de sensibilidad',
        description: 'Permite probar <b>otros pesos sin cambiar la matriz</b>. Por ejemplo el «Escenario B»: Monto 20 → 10 % y Jurisdicción 20 → 30 %. Luego presionas «Ejecutar prueba».',
        side: 'right',
        onPrevClick: jump('ponderaciones', 'cambios', 'prev'),
      },
    },
    {
      element: sel('resultado'),
      popover: {
        title: '¿Cambia el orden?',
        description: 'Se compara el riesgo de cada evento con los pesos vigentes contra el escenario. Si el <b>orden de atención cambia</b>, la priorización es sensible a esos pesos; si no, es estable.',
        side: 'left',
        onNextClick: jump('metodologia', 'formulas', 'next'),
      },
    },
    {
      element: sel('formulas'),
      popover: {
        title: 'Metodología',
        description: 'Resumen de las tres reglas: cálculo del <b>inherente</b>, <b>ajuste</b> a residual y regla de <b>dato faltante</b>.',
        side: 'bottom',
        onPrevClick: jump('sensibilidad', 'resultado', 'prev'),
      },
    },
    {
      element: sel('diccionario'),
      popover: {
        title: 'Diccionario de factores',
        description: 'Qué significa cada puntaje de <b>0 a 5</b> en cada factor. Así todos los analistas califican con el <b>mismo criterio</b> y el resultado es homogéneo.',
        side: 'top',
      },
    },
    {
      element: sel('mapa'),
      popover: {
        title: 'Mapa de controles y agravantes',
        description: 'Catálogo de controles que <b>restan</b> puntos y agravantes que los <b>suman</b>, con su valor.',
        side: 'top',
        ...(canCreate ? { onNextClick: jump('tablero', 'registrar', 'next') } : {}),
      },
    },
  ]

  if (canCreate) {
    steps.push({
      element: sel('registrar'),
      popover: {
        title: 'Registrar un evento',
        description: 'Aquí registras un evento nuevo: calificas los 7 factores, eliges controles y agravantes, y ves el puntaje <b>en vivo</b>. También puedes verificar al cliente en las <b>listas restrictivas</b>. Al guardarlo aparece en el ranking según su riesgo.',
        side: 'left',
        onPrevClick: jump('metodologia', 'mapa', 'prev'),
      },
    })
  }

  d = runTour(steps)
}
