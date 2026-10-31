import { randomInt } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../db';
import { requirePermission } from '../middleware/auth';
import { PERMISSIONS, ROLE_LABEL } from '../config/permissions';
import { LEVELS, MISSING_SCORE } from '../config/riskMatrix';
import { audit } from '../services/audit';
import { currentVersion } from '../services/matrixData';
import { getSettings, settingsMeta, settingsSchema, updateSettings } from '../services/settings';

export const adminRouter = Router();

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? 'Datos inválidos';

// Contraseña temporal fuerte: 14 caracteres con mayúsculas, minúsculas, números y símbolos.
// Se muestra una sola vez al administrador; en la BD solo queda el hash bcrypt.
function tempPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#$%*-_?'];
  const all = sets.join('');
  const chars = sets.map(s => s[randomInt(s.length)]);
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ─── Permisos por rol (consulta pública para usuarios autenticados) ───────────

adminRouter.get('/permissions', (_req, res) => {
  res.json({
    roles: Object.values(Role).map(r => ({ key: r, label: ROLE_LABEL[r] })),
    permissions: Object.entries(PERMISSIONS).map(([key, p]) => ({ key, label: p.label, roles: p.roles })),
  });
});

// ─── Usuarios y roles ─────────────────────────────────────────────────────────

const userView = {
  id: true, username: true, fullName: true, role: true, active: true,
  failedAttempts: true, lockedUntil: true, lastLoginAt: true, createdAt: true,
} as const;

adminRouter.get('/users', requirePermission('system.manage'), async (_req, res) => {
  const users = await prisma.user.findMany({ select: userView, orderBy: { id: 'asc' } });
  res.json({ users: users.map(u => ({ ...u, roleLabel: ROLE_LABEL[u.role], locked: !!u.lockedUntil && u.lockedUntil > new Date() })) });
});

const createSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9._-]{2,29}$/, 'Usuario: 3 a 30 caracteres, empieza con letra; solo letras, números, punto, guion o guion bajo'),
  fullName: z.string().trim().min(3, 'Nombre: mínimo 3 caracteres').max(80),
  role: z.enum(Role),
});

adminRouter.post('/users', requirePermission('system.manage'), async (req, res) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: firstError(body.error) });
  if (await prisma.user.findUnique({ where: { username: body.data.username } })) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
  }
  const password = tempPassword();
  const user = await prisma.user.create({
    data: { ...body.data, passwordHash: await bcrypt.hash(password, 12) },
    select: userView,
  });
  await audit(req, 'USER_CREATE', { detail: `${user.username} (${ROLE_LABEL[user.role]})` });
  res.status(201).json({ user, password });
});

// Cambiar rol o activar/desactivar. Nadie se cambia a sí mismo y siempre queda un administrador activo.
adminRouter.patch('/users/:id', requirePermission('system.manage'), async (req, res) => {
  const body = z.object({ role: z.enum(Role).optional(), active: z.boolean().optional(), fullName: z.string().trim().min(3).max(80).optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: firstError(body.error) });
  const id = Number(req.params.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

  const { role, active, fullName } = body.data;
  if (id === req.user!.id && ((role && role !== target.role) || active === false)) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol ni desactivar tu propia cuenta' });
  }
  const losesAdmin = target.role === 'ADMIN' && target.active && ((role && role !== 'ADMIN') || active === false);
  if (losesAdmin && (await prisma.user.count({ where: { role: 'ADMIN', active: true } })) <= 1) {
    return res.status(400).json({ error: 'Debe quedar al menos un administrador activo' });
  }

  const user = await prisma.user.update({ where: { id }, data: { role, active, fullName }, select: userView });
  const changes = [
    role && role !== target.role && `rol ${ROLE_LABEL[target.role]} → ${ROLE_LABEL[role]}`,
    active !== undefined && active !== target.active && (active ? 'activado' : 'desactivado'),
    fullName && fullName !== target.fullName && `nombre «${fullName}»`,
  ].filter(Boolean);
  if (changes.length) await audit(req, 'USER_UPDATE', { detail: `${target.username}: ${changes.join(', ')}` });
  res.json({ user });
});

adminRouter.post('/users/:id/unlock', requirePermission('system.manage'), async (req, res) => {
  const user = await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { failedAttempts: 0, lockedUntil: null },
    select: userView,
  }).catch(() => null);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  await audit(req, 'USER_UNLOCK', { detail: user.username });
  res.json({ user });
});

adminRouter.post('/users/:id/reset-password', requirePermission('system.manage'), async (req, res) => {
  const password = tempPassword();
  const user = await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { passwordHash: await bcrypt.hash(password, 12), failedAttempts: 0, lockedUntil: null },
    select: userView,
  }).catch(() => null);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  await audit(req, 'USER_RESET_PASSWORD', { detail: user.username });
  res.json({ user, password });
});

// ─── Parámetros del sistema ───────────────────────────────────────────────────

adminRouter.get('/settings', requirePermission('system.manage'), async (_req, res) => {
  const [settings, meta, version] = await Promise.all([getSettings(), settingsMeta(), currentVersion()]);
  res.json({
    settings,
    updatedAt: meta?.updatedAt ?? null,
    updatedBy: meta?.updatedBy ?? null,
    // Los parámetros de la matriz no se editan aquí: pasan por control de cambios y los aprueba el Auditor/QA.
    matrix: { version: version?.version ?? null, weights: version?.weights ?? null, levels: LEVELS, missingScore: MISSING_SCORE },
  });
});

const SETTING_LABEL: Record<string, string> = {
  sessionMinutes: 'Duración de la sesión', maxFailedAttempts: 'Intentos fallidos', lockMinutes: 'Duración del bloqueo',
  listStaleHours: 'Listas desactualizadas', incidentSlaDays: 'Plazo de incidencias',
};

adminRouter.put('/settings', requirePermission('system.manage'), async (req, res) => {
  const body = settingsSchema.safeParse(req.body);
  if (!body.success) {
    const issue = body.error.issues[0];
    return res.status(400).json({ error: `${SETTING_LABEL[String(issue?.path[0])] ?? 'Parámetro'}: ${issue?.message}` });
  }
  const before = await getSettings();
  const settings = await updateSettings(body.data, req.user!.id);
  const changes = (Object.keys(settings) as (keyof typeof settings)[])
    .filter(k => settings[k] !== before[k])
    .map(k => `${SETTING_LABEL[k]} ${before[k]} → ${settings[k]}`);
  if (changes.length) await audit(req, 'SETTINGS_UPDATE', { detail: changes.join('; ') });
  res.json({ settings });
});

// ─── Bitácora de auditoría (administrador y Auditor/QA, solo lectura) ─────────

const auditQuery = z.object({
  q: z.string().trim().max(100).optional().default(''),
  action: z.string().trim().max(40).optional().default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

adminRouter.get('/audit', requirePermission('audit.view'), async (req, res) => {
  const parsed = auditQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Parámetros inválidos' });
  const { q, action, page } = parsed.data;
  const pageSize = 50;
  const where = {
    ...(action ? { action } : {}),
    ...(q ? { OR: [{ username: { contains: q, mode: 'insensitive' as const } }, { detail: { contains: q, mode: 'insensitive' as const } }] } : {}),
  };
  const [total, logs, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, createdAt: true, username: true, action: true, detail: true, ip: true },
    }),
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
  ]);
  res.json({ total, page, pageSize, logs, actions: actions.map(a => a.action) });
});
