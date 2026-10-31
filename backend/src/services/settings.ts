import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../config/env';

// Límites de cada parámetro: el administrador no puede dejar el sistema en un estado inseguro
// (por ejemplo, sesiones de un día o bloqueo desactivado).
export const settingsSchema = z.object({
  sessionMinutes: z.number().int().min(5).max(240),
  maxFailedAttempts: z.number().int().min(3).max(10),
  lockMinutes: z.number().int().min(5).max(120),
  listStaleHours: z.number().int().min(12).max(168),
  incidentSlaDays: z.number().int().min(1).max(30),
});
export type Settings = z.infer<typeof settingsSchema>;

const KEYS = Object.keys(settingsSchema.shape) as (keyof Settings)[];
const pick = (row: Settings): Settings => Object.fromEntries(KEYS.map(k => [k, row[k]])) as Settings;

let cache: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  const row = await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: {},
    // Si la fila no existe, se crea con los valores de backend/.env.
    create: { id: 1, sessionMinutes: env.sessionMinutes, maxFailedAttempts: env.maxFailedAttempts, lockMinutes: env.lockMinutes },
  });
  cache = pick(row);
  return cache;
}

export async function updateSettings(data: Settings, userId: number) {
  const row = await prisma.systemConfig.update({ where: { id: 1 }, data: { ...data, updatedById: userId } });
  cache = pick(row);
  return cache;
}

export const settingsMeta = () =>
  prisma.systemConfig.findUnique({
    where: { id: 1 },
    select: { updatedAt: true, updatedBy: { select: { username: true, fullName: true } } },
  });
