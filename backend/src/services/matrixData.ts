import { prisma } from '../db';
import { LISTS } from '../config/lists';
import type { Scores, Weights } from '../config/riskMatrix';
import { normalize } from '../utils/normalize';
import { computeScore, rank } from './riskScore';

export const userSelect = { select: { username: true, fullName: true, role: true } } as const;

// Versión de ponderaciones vigente: la última aprobada.
export function currentVersion() {
  return prisma.weightVersion.findFirst({
    where: { status: 'APROBADA' },
    orderBy: { reviewedAt: 'desc' },
    include: { createdBy: userSelect, reviewedBy: userSelect },
  });
}

// Todos los eventos con su puntaje, en orden de atención (mayor riesgo residual primero).
export async function scoredEvents(weights: Weights) {
  const events = await prisma.riskEvent.findMany({ include: { adjustments: true } });
  return rank(
    events.map(e => ({
      id: e.id,
      code: e.code,
      description: e.description,
      clientName: e.clientName,
      product: e.product,
      channel: e.channel,
      country: e.country,
      amount: e.amount?.toString() ?? null,
      currency: e.currency,
      createdAt: e.createdAt,
      adjustments: e.adjustments.map(a => ({ type: a.type, description: a.description, points: a.points })),
      score: computeScore(e.scores as Scores, e.adjustments, weights),
    })),
  );
}

// Busca un nombre (y sus alias) en las listas restrictivas vigentes.
export async function screenName(name: string, take = 5) {
  const lists = await prisma.sanctionList.findMany({ where: { active: true, batchId: { not: null } } });
  if (lists.length === 0) return [];
  const matches = await prisma.sanctionRecord.findMany({
    where: { OR: lists.map(l => ({ listKey: l.key, batchId: l.batchId! })), searchNorm: { contains: normalize(name) } },
    take,
    select: { listKey: true, name: true, schema: true, countries: true },
  });
  return matches.map(m => ({ ...m, listName: LISTS.find(l => l.key === m.listKey)?.name ?? m.listKey }));
}
