import type { IncidentStatus, Role } from '../../lib/api'

export type RaciCode = 'R' | 'A' | 'C' | 'I' | 'A/R'

// R = Ejecuta · A = Responde (una sola A por actividad) · C = Consultado · I = Informado · A/R = Responde y ejecuta
export const RACI_STYLE: Record<RaciCode, string> = {
  R: 'bg-sky-100 text-sky-800',
  A: 'bg-orange-100 text-orange-800',
  'A/R': 'bg-orange-300 text-orange-950',
  C: 'bg-amber-100 text-amber-800',
  I: 'bg-slate-100 text-slate-500',
}

export const RACI_LEGEND: { code: RaciCode; label: string }[] = [
  { code: 'R', label: 'Ejecuta' },
  { code: 'A', label: 'Responde (una sola A por actividad)' },
  { code: 'C', label: 'Consultado' },
  { code: 'I', label: 'Informado' },
  { code: 'A/R', label: 'Responde y ejecuta' },
]

type TeamRole = Exclude<Role, 'ADMIN'>

export interface RaciActivity {
  n: number
  activity: string
  cells: Record<TeamRole, RaciCode>
  // Celdas ajustadas respecto a la matriz original del equipo (le faltaba la A).
  adjusted?: Partial<Record<TeamRole, RaciCode>>
}

// Matriz RACI del equipo. En las actividades 1, 3 y 4 no había ninguna A (la hoja marcaba «REVISAR»):
// se asigna al líder de proyecto, que responde por el trabajo; el Auditor/QA responde por la evidencia.
export const RACI: RaciActivity[] = [
  { n: 1, activity: 'Detectar y registrar la incidencia', cells: { LIDER: 'A', ANALISTA_RIESGO: 'R', ANALISTA_DATOS: 'R', DESARROLLADOR_BI: 'C', AUDITOR: 'I' }, adjusted: { LIDER: 'I' } },
  { n: 2, activity: 'Clasificar causa (captura, regla o cálculo)', cells: { LIDER: 'A', ANALISTA_RIESGO: 'C', ANALISTA_DATOS: 'R', DESARROLLADOR_BI: 'C', AUDITOR: 'I' } },
  { n: 3, activity: 'Corregir dato sintético / escenario', cells: { LIDER: 'A', ANALISTA_RIESGO: 'R', ANALISTA_DATOS: 'C', DESARROLLADOR_BI: 'I', AUDITOR: 'I' }, adjusted: { LIDER: 'I' } },
  { n: 4, activity: 'Corregir fórmula o visualización', cells: { LIDER: 'A', ANALISTA_RIESGO: 'I', ANALISTA_DATOS: 'C', DESARROLLADOR_BI: 'R', AUDITOR: 'I' }, adjusted: { LIDER: 'I' } },
  { n: 5, activity: 'Ajustar ponderaciones o regla', cells: { LIDER: 'A', ANALISTA_RIESGO: 'C', ANALISTA_DATOS: 'R', DESARROLLADOR_BI: 'I', AUDITOR: 'C' } },
  { n: 6, activity: 'Aprobar el cambio de versión', cells: { LIDER: 'I', ANALISTA_RIESGO: 'I', ANALISTA_DATOS: 'C', DESARROLLADOR_BI: 'I', AUDITOR: 'A/R' } },
  { n: 7, activity: 'Revalidar el score (se reproduce factor por factor)', cells: { LIDER: 'I', ANALISTA_RIESGO: 'I', ANALISTA_DATOS: 'R', DESARROLLADOR_BI: 'C', AUDITOR: 'A' } },
  { n: 8, activity: 'Documentar en control de cambios', cells: { LIDER: 'I', ANALISTA_RIESGO: 'I', ANALISTA_DATOS: 'R', DESARROLLADOR_BI: 'I', AUDITOR: 'A' } },
  { n: 9, activity: 'Informar al patrocinador si hay impacto', cells: { LIDER: 'A/R', ANALISTA_RIESGO: 'C', ANALISTA_DATOS: 'I', DESARROLLADOR_BI: 'I', AUDITOR: 'C' } },
]

// Validación de la hoja: exactamente una A (o A/R) por actividad.
export const countA = (a: RaciActivity) => Object.values(a.cells).filter(c => c === 'A' || c === 'A/R').length

export const RACI_RULES = [
  'Una sola A por actividad. Los cambios de ponderación o regla los aprueba el Auditor/QA, nunca quien los propone.',
  'Quien corrige no valida: separación de funciones (corrige Riesgo, Datos o BI; revalida otra persona y aprueba el Auditor/QA).',
  'Todo cambio deja rastro: quién, cuándo, por qué y quién aprobó.',
  'Nada se corrige en silencio: si el dato dañado alteró el orden de atención, se recalcula y se anota el impacto.',
  'Fuera de alcance: no se tocan datos reales ni sistemas productivos.',
]

export interface FlowStep {
  n: number
  stage: string
  what: string
  responsible: string
  evidence: string
  raci: number[] // actividades de la matriz RACI que cubre el paso
  status?: IncidentStatus // estado en el que la incidencia espera este paso
}

export const FLOW: FlowStep[] = [
  { n: 1, stage: 'Detección', what: 'La matriz marca «dato faltante» (puntaje conservador de 3) o una validación falla. El evento nunca se descarta.', responsible: 'Analista de riesgo / Analista de datos', evidence: 'Marca en el tablero + registro de incidencia', raci: [1] },
  { n: 2, stage: 'Registro', what: 'Se documenta: evento, factor afectado, qué falló, fecha. Se guarda la posición del evento en el ranking.', responsible: 'Analista de riesgo', evidence: 'Fila en el registro de incidencias', raci: [1] },
  { n: 3, stage: 'Diagnóstico', what: 'Se determina si es error de captura, de regla/ponderación o de cálculo.', responsible: 'Analista de datos', evidence: 'Causa clasificada', raci: [2], status: 'REGISTRADA' },
  { n: 4, stage: 'Corrección', what: 'Se corrige la fuente sintética, la regla o la fórmula según la causa.', responsible: 'Riesgo / Datos / BI según causa', evidence: 'Cambio documentado (antes → después)', raci: [3, 4, 5], status: 'DIAGNOSTICADA' },
  { n: 5, stage: 'Revalidación', what: 'Se recalcula el score y se verifica que se reproduce factor por factor. El sistema mide si cambió el orden de atención.', responsible: 'Analista de datos (A: Auditor/QA)', evidence: 'Prueba 1 «El score se reproduce»', raci: [7], status: 'CORREGIDA' },
  { n: 6, stage: 'Cierre', what: 'Se archiva la evidencia; si cambió una regla, nueva versión (ej. v1.1 → v1.2) aprobada por Auditor/QA. Si hubo impacto, antes se informa al patrocinador.', responsible: 'Analista de datos (A: Auditor/QA)', evidence: 'Entrada en control de cambios', raci: [6, 8, 9], status: 'REVALIDADA' },
]
