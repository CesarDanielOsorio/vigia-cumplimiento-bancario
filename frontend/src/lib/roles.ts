import type { Role } from './api'

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador del sistema',
  LIDER: 'Líder de proyecto',
  ANALISTA_RIESGO: 'Analista de riesgo',
  ANALISTA_DATOS: 'Analista de datos',
  DESARROLLADOR_BI: 'Desarrollador BI',
  AUDITOR: 'Auditor/QA',
}

// Roles del equipo en el orden de las columnas de la matriz RACI.
export const TEAM_ROLES: Role[] = ['LIDER', 'ANALISTA_RIESGO', 'ANALISTA_DATOS', 'DESARROLLADOR_BI', 'AUDITOR']

// Quién puede hacer algo, en palabras: el administrador se menciona aparte porque puede todo lo operativo.
export const whoCan = (roles: Role[]) => {
  const team = roles.filter(r => r !== 'ADMIN').map(r => ROLE_LABEL[r])
  return team.length ? team.join(' o ') : ROLE_LABEL.ADMIN
}
