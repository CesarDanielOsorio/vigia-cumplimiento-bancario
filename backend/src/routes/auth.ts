import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db';
import { ROLE_LABEL, permissionsOf } from '../config/permissions';
import { audit } from '../services/audit';
import { getSettings } from '../services/settings';
import { SESSION_COOKIE, cookieOptions, requireAuth, signSession, type SessionUser } from '../middleware/auth';

export const authRouter = Router();

// Límite por IP: frena ataques de fuerza bruta aunque se roten usuarios.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos desde esta dirección. Intenta de nuevo en 15 minutos.' },
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(128),
});

// Hash ficticio: si el usuario no existe igual se ejecuta bcrypt, así el tiempo de respuesta
// no revela qué usuarios existen (enumeración de usuarios).
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', 12);
const GENERIC_ERROR = 'Usuario o contraseña incorrectos';

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos de inicio de sesión inválidos' });
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await audit(req, 'LOGIN_LOCKED', { userId: user.id, username: user.username });
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({ error: `Cuenta bloqueada temporalmente. Intenta en ${mins} min.` });
  }

  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !ok) {
    if (user) {
      const { maxFailedAttempts, lockMinutes } = await getSettings();
      const attempts = user.failedAttempts + 1;
      const lock = attempts >= maxFailedAttempts;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: lock ? 0 : attempts,
          lockedUntil: lock ? new Date(Date.now() + lockMinutes * 60000) : null,
        },
      });
      await audit(req, lock ? 'LOGIN_LOCKED' : 'LOGIN_FAIL', {
        userId: user.id,
        username: user.username,
        detail: lock ? `Bloqueada ${lockMinutes} min tras ${attempts} intentos` : `Intento ${attempts}`,
      });
    } else {
      await audit(req, 'LOGIN_FAIL', { username, detail: 'Usuario inexistente' });
    }
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const session = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
  res.cookie(SESSION_COOKIE, await signSession(session), await cookieOptions());
  await audit(req, 'LOGIN_OK', { userId: user.id, username: user.username });
  res.json({ user: present(session) });
});

// El frontend recibe los permisos del rol para mostrar solo lo que el usuario puede hacer;
// el backend los vuelve a verificar en cada ruta.
const present = (u: SessionUser) => ({ ...u, roleLabel: ROLE_LABEL[u.role], permissions: permissionsOf(u.role) });

authRouter.post('/logout', requireAuth, async (req, res) => {
  await audit(req, 'LOGOUT');
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: present(req.user!) });
});
