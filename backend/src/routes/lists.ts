import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { LISTS, isListKey } from '../config/lists';
import { syncAll, syncList } from '../services/syncList';
import { audit } from '../services/audit';
import { requirePermission } from '../middleware/auth';
import { getSettings } from '../services/settings';
import { normalize } from '../utils/normalize';

export const listsRouter = Router();

listsRouter.get('/', async (_req, res) => {
  const rows = await prisma.sanctionList.findMany();
  const byKey = new Map(rows.map(r => [r.key, r]));

  const lists = LISTS.map(cfg => {
    const r = byKey.get(cfg.key);
    return {
      key: cfg.key,
      name: cfg.name,
      description: cfg.description,
      icon: cfg.icon,
      color: cfg.color,
      sources: cfg.sources,
      active: r?.active ?? false,
      recordCount: r?.recordCount ?? 0,
      lastSyncAt: r?.lastSyncAt ?? null,
      syncStatus: r?.syncStatus ?? 'idle',
      syncError: r?.syncError ?? null,
    };
  });

  const { listStaleHours } = await getSettings();
  const active = lists.filter(l => l.active);
  const syncDates = active.map(l => l.lastSyncAt);
  // La fecha del resumen es la más antigua: si una lista nunca se sincronizó, el resumen es "Nunca".
  const lastSyncAt = syncDates.some(d => !d)
    ? null
    : syncDates.reduce<Date | null>((min, d) => (!min || d! < min ? d : min), null);

  res.json({
    summary: {
      totalRecords: active.reduce((s, l) => s + l.recordCount, 0),
      lastSyncAt,
      isStale: !lastSyncAt || Date.now() - lastSyncAt.getTime() > listStaleHours * 3600 * 1000,
      activeLists: active.length,
    },
    lists,
  });
});

// Sincronizar es costoso (cientos de MB): solo administradores.
listsRouter.post('/sync', requirePermission('lists.sync'), async (req, res) => {
  const running = await prisma.sanctionList.count({ where: { syncStatus: 'running' } });
  if (running) return res.status(409).json({ error: 'Ya hay una sincronización en curso' });
  await audit(req, 'SYNC_ALL');
  void syncAll(); // segundo plano
  res.status(202).json({ ok: true });
});

listsRouter.post('/:key/sync', requirePermission('lists.sync'), async (req, res) => {
  const key = String(req.params.key);
  if (!isListKey(key)) return res.status(404).json({ error: 'Lista no encontrada' });
  const list = await prisma.sanctionList.findUnique({ where: { key } });
  if (list?.syncStatus === 'running') return res.status(409).json({ error: 'La lista ya se está sincronizando' });
  await audit(req, 'SYNC_LIST', { detail: key });
  syncList(key).catch(() => {}); // el error queda guardado en la lista
  res.status(202).json({ ok: true });
});

const recordsQuery = z.object({
  q: z.string().trim().max(100).optional().default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

listsRouter.get('/:key/records', async (req, res) => {
  const key = String(req.params.key);
  if (!isListKey(key)) return res.status(404).json({ error: 'Lista no encontrada' });
  const parsed = recordsQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Parámetros inválidos' });
  const { q, page, pageSize } = parsed.data;

  const list = await prisma.sanctionList.findUnique({ where: { key } });
  const cfg = LISTS.find(l => l.key === key)!;
  if (!list?.batchId) return res.json({ list: { key, name: cfg.name }, total: 0, page, pageSize, records: [] });

  // Prisma parametriza la consulta: el texto del usuario nunca se concatena al SQL (evita inyección).
  const where = {
    listKey: key,
    batchId: list.batchId,
    ...(q ? { searchNorm: { contains: normalize(q) } } : {}),
  };

  const [total, records] = await Promise.all([
    q ? prisma.sanctionRecord.count({ where }) : Promise.resolve(list.recordCount),
    prisma.sanctionRecord.findMany({
      where,
      orderBy: [{ sortKey: 'asc' }, { id: 'asc' }], // A-Z primero; números y símbolos al final
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, entityId: true, schema: true, name: true, aliases: true,
        countries: true, birthDate: true, dataset: true, sanctions: true,
      },
    }),
  ]);

  if (q) await audit(req, 'VIEW_RECORDS', { detail: `${key}: "${q}"` });
  res.json({ list: { key, name: cfg.name }, total, page, pageSize, records });
});
