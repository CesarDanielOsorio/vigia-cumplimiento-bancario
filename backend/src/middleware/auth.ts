import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { can, type Permission } from '../config/permissions';
import { prisma } from '../db';
import { getSettings } from '../services/settings';

export const SESSION_COOKIE = 'session';

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

// La duración de la sesión se configura en Configuración → Seguridad.
export async function signSession(user: SessionUser) {
  const { sessionMinutes } = await getSettings();
  return jwt.sign({ sub: String(user.id) }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: sessionMinutes * 60,
  });
}

// Cookie httpOnly: el JavaScript del navegador no puede leer el token (mitiga XSS).
// SameSite=Strict: el navegador no la envía desde otros sitios (mitiga CSRF).
export const cookieOptions = async () => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: env.isProd,
  maxAge: (await getSettings()).sessionMinutes * 60 * 1000,
  path: '/',
});

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    // Se consulta la BD en cada petición para que desactivar/bloquear un usuario surta efecto inmediato.
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user || !user.active) return res.status(401).json({ error: 'Sesión inválida' });
    req.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    next();
  } catch {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return res.status(401).json({ error: 'Sesión expirada' });
  }
}

export const requirePermission = (p: Permission) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !can(req.user.role, p)) {
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  }
  next();
};
