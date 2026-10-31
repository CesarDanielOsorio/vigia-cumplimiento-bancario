import type { IncidentCause, Role } from '@prisma/client';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador del sistema',
  LIDER: 'Líder de proyecto',
  ANALISTA_RIESGO: 'Analista de riesgo',
  ANALISTA_DATOS: 'Analista de datos',
  DESARROLLADOR_BI: 'Desarrollador BI',
  AUDITOR: 'Auditor/QA',
};

/**
 * Qué puede hacer cada rol. Es la única fuente: el backend la aplica en cada ruta
 * y el frontend la recibe en /auth/me para mostrar u ocultar acciones.
 *
 * El administrador ve todo, configura y puede ejecutar las tareas operativas (R),
 * pero las aprobaciones (A del Auditor/QA en el RACI) no se delegan: así ningún
 * usuario, ni siquiera el administrador, puede proponer y aprobar a la vez.
 */
export const PERMISSIONS = {
  'lists.sync': { label: 'Sincronizar listas restrictivas', roles: ['ADMIN'] },
  'events.create': { label: 'Registrar eventos sintéticos', roles: ['ADMIN', 'ANALISTA_RIESGO'] },
  'weights.propose': { label: 'Proponer ponderaciones o reglas', roles: ['ADMIN', 'LIDER', 'ANALISTA_DATOS'] },
  'weights.approve': { label: 'Aprobar o rechazar versiones', roles: ['AUDITOR'] },
  'incidents.register': { label: 'Detectar y registrar incidencias', roles: ['ADMIN', 'ANALISTA_RIESGO', 'ANALISTA_DATOS'] },
  'incidents.diagnose': { label: 'Clasificar la causa', roles: ['ADMIN', 'ANALISTA_DATOS'] },
  'incidents.correct.CAPTURA': { label: 'Corregir dato sintético o escenario', roles: ['ADMIN', 'ANALISTA_RIESGO'] },
  'incidents.correct.REGLA': { label: 'Ajustar ponderaciones o regla', roles: ['ADMIN', 'ANALISTA_DATOS'] },
  'incidents.correct.CALCULO': { label: 'Corregir fórmula o visualización', roles: ['ADMIN', 'DESARROLLADOR_BI'] },
  'incidents.revalidate': { label: 'Revalidar el score', roles: ['ADMIN', 'ANALISTA_DATOS'] },
  'incidents.close': { label: 'Aprobar y cerrar incidencias', roles: ['AUDITOR'] },
  'incidents.sponsor': { label: 'Informar al patrocinador', roles: ['ADMIN', 'LIDER'] },
  'audit.view': { label: 'Consultar la bitácora de auditoría', roles: ['ADMIN', 'AUDITOR'] },
  'system.manage': { label: 'Administrar usuarios y parámetros', roles: ['ADMIN'] },
} satisfies Record<string, { label: string; roles: Role[] }>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role, p: Permission) => (PERMISSIONS[p].roles as Role[]).includes(role);

export const permissionsOf = (role: Role) => (Object.keys(PERMISSIONS) as Permission[]).filter(p => can(role, p));

export const correctPermission = (cause: IncidentCause): Permission => `incidents.correct.${cause}`;
