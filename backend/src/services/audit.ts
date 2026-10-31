import type { Request } from 'express';
import { prisma } from '../db';

export type AuditAction =
  | 'LOGIN_OK'
  | 'LOGIN_FAIL'
  | 'LOGIN_LOCKED'
  | 'LOGOUT'
  | 'SYNC_ALL'
  | 'SYNC_LIST'
  | 'VIEW_RECORDS'
  | 'RISK_EVENT_CREATE'
  | 'RISK_SCREEN'
  | 'WEIGHTS_PROPOSE'
  | 'WEIGHTS_APPROVE'
  | 'WEIGHTS_REJECT'
  | 'WEIGHTS_SELF_REVIEW_DENIED'
  | 'SENSITIVITY_RUN'
  | 'INCIDENT_REGISTER'
  | 'INCIDENT_DIAGNOSE'
  | 'INCIDENT_CORRECT'
  | 'INCIDENT_REVALIDATE'
  | 'INCIDENT_RETURN'
  | 'INCIDENT_SPONSOR'
  | 'INCIDENT_CLOSE'
  | 'INCIDENT_SOD_DENIED'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_UNLOCK'
  | 'USER_RESET_PASSWORD'
  | 'SETTINGS_UPDATE'
  | 'DEMO_RESET';

// La bitácora nunca debe tumbar la petición: si falla, se reporta en consola.
export async function audit(
  req: Request,
  action: AuditAction,
  opts: { userId?: number; username?: string; detail?: string } = {},
) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: opts.userId ?? req.user?.id,
        username: opts.username ?? req.user?.username,
        detail: opts.detail,
        ip: req.ip,
        userAgent: req.get('user-agent')?.slice(0, 255),
      },
    });
  } catch (e) {
    console.error('[audit] no se pudo registrar', action, e);
  }
}
