import {
  CheckCheck, ClipboardPen, CornerUpLeft, FilePlus2, Megaphone, RefreshCcw, SearchCheck, Wrench, type LucideIcon,
} from 'lucide-react'
import type { IncidentCause, IncidentStatus } from '../../lib/api'

export const STATUS_STYLE: Record<IncidentStatus, { label: string; badge: string; dot: string }> = {
  REGISTRADA: { label: 'Registrada', badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  DIAGNOSTICADA: { label: 'Diagnosticada', badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  CORREGIDA: { label: 'Corregida', badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  REVALIDADA: { label: 'Revalidada', badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-400' },
  CERRADA: { label: 'Cerrada', badge: 'bg-mint-50 text-mint-700 ring-mint-200', dot: 'bg-mint-500' },
}

export const CAUSE_LABEL: Record<IncidentCause, string> = {
  CAPTURA: 'Captura',
  REGLA: 'Regla / ponderación',
  CALCULO: 'Cálculo / visualización',
}

export const CAUSE_HELP: Record<IncidentCause, string> = {
  CAPTURA: 'El dato del evento sintético se registró mal o vacío. Corrige el analista de riesgo.',
  REGLA: 'Una ponderación o regla de la matriz no es adecuada. Ajusta el analista de datos con una versión nueva que aprueba el Auditor/QA.',
  CALCULO: 'La fórmula o la visualización muestra un resultado incorrecto. Corrige el desarrollador BI.',
}

export const STEP_STYLE: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  REGISTRO: { label: 'Detección y registro', icon: FilePlus2, color: 'bg-slate-100 text-slate-600' },
  DIAGNOSTICO: { label: 'Diagnóstico', icon: SearchCheck, color: 'bg-sky-100 text-sky-700' },
  CORRECCION: { label: 'Corrección', icon: Wrench, color: 'bg-violet-100 text-violet-700' },
  REVALIDACION: { label: 'Revalidación', icon: RefreshCcw, color: 'bg-amber-100 text-amber-800' },
  DEVUELTA: { label: 'Devuelta a corrección', icon: CornerUpLeft, color: 'bg-orange-100 text-orange-700' },
  PATROCINADOR: { label: 'Aviso al patrocinador', icon: Megaphone, color: 'bg-rose-100 text-rose-700' },
  CIERRE: { label: 'Cierre aprobado', icon: CheckCheck, color: 'bg-mint-100 text-mint-700' },
  NOTA: { label: 'Nota', icon: ClipboardPen, color: 'bg-slate-100 text-slate-600' },
}

export const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

export const isoDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA') // AAAA-MM-DD, como en la hoja del equipo
