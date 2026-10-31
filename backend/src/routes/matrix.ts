import { Router, type Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requirePermission } from '../middleware/auth';
import { audit } from '../services/audit';
import { computeScore } from '../services/riskScore';
import { currentVersion, scoredEvents, screenName, userSelect } from '../services/matrixData';
import {
  ADJUSTMENT_CATALOG, FACTOR_KEYS, FACTORS, LEVELS, MISSING_SCORE,
  type Scores, type Weights,
} from '../config/riskMatrix';

export const matrixRouter = Router();

// ─── Validación ───────────────────────────────────────────────────────────────

const weightsSchema = z
  .object(Object.fromEntries(FACTOR_KEYS.map(k => [k, z.number().int().min(0).max(100)])) as Record<
    (typeof FACTOR_KEYS)[number], z.ZodNumber
  >)
  .strict()
  .refine(w => Object.values(w).reduce((s, v) => s + v, 0) === 100, { message: 'Las ponderaciones deben sumar 100 %' });

const scoresSchema = z
  .object(Object.fromEntries(FACTOR_KEYS.map(k => [k, z.number().int().min(0).max(5).nullable()])) as Record<
    (typeof FACTOR_KEYS)[number], z.ZodNullable<z.ZodNumber>
  >)
  .strict();

const adjustmentSchema = z.object({
  type: z.enum(['CONTROL', 'AGRAVANTE']),
  description: z.string().trim().min(3).max(200),
  points: z.number().int().min(1).max(20),
});

const eventSchema = z.object({
  description: z.string().trim().min(10).max(500),
  clientName: z.string().trim().min(3).max(120),
  product: z.string().trim().min(2).max(120),
  channel: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(120),
  amount: z.number().nonnegative().max(1e12).nullable(),
  currency: z.enum(['USD', 'GTQ', 'EUR']),
  scores: scoresSchema,
  adjustments: z.array(adjustmentSchema).max(10),
});

const FIELD_LABEL: Record<string, string> = {
  description: 'Descripción', clientName: 'Cliente', product: 'Producto', channel: 'Canal',
  country: 'País', amount: 'Monto', currency: 'Moneda', reason: 'Motivo', weights: 'Ponderaciones',
  scores: 'Factores', adjustments: 'Controles y agravantes',
};
const firstError = (e: z.ZodError) => {
  const issue = e.issues[0];
  if (!issue) return 'Datos inválidos';
  const field = FIELD_LABEL[String(issue.path[0])];
  return field ? `${field}: ${issue.message}` : issue.message;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function nextVersionName() {
  const versions = await prisma.weightVersion.findMany({ select: { version: true } });
  const minor = Math.max(-1, ...versions.map(v => Number(v.version.split('.')[1] ?? 0)));
  return `v1.${minor + 1}`;
}

// ─── Metodología ──────────────────────────────────────────────────────────────

matrixRouter.get('/methodology', (_req, res) => {
  res.json({ factors: FACTORS, levels: LEVELS, missingScore: MISSING_SCORE, catalog: ADJUSTMENT_CATALOG });
});

// ─── Eventos y ranking ────────────────────────────────────────────────────────

matrixRouter.get('/events', async (req, res) => {
  const versionId = Number(req.query.versionId) || undefined;
  const version = versionId
    ? await prisma.weightVersion.findUnique({ where: { id: versionId }, include: { createdBy: userSelect, reviewedBy: userSelect } })
    : await currentVersion();
  if (!version) return res.status(404).json({ error: 'No hay una versión de ponderaciones aprobada' });
  res.json({ version, events: await scoredEvents(version.weights as Weights) });
});

matrixRouter.post('/events', requirePermission('events.create'), async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  const { adjustments, amount, ...data } = parsed.data;

  const last = await prisma.riskEvent.findFirst({ orderBy: { id: 'desc' }, select: { code: true } });
  const next = (Number(last?.code.split('-')[1]) || 0) + 1;
  const code = `EV-${String(next).padStart(3, '0')}`;

  const event = await prisma.riskEvent.create({
    data: {
      ...data,
      code,
      amount: amount === null ? null : new Prisma.Decimal(amount),
      createdById: req.user!.id,
      adjustments: { create: adjustments },
    },
  });
  await audit(req, 'RISK_EVENT_CREATE', { detail: code });
  res.status(201).json({ id: event.id, code });
});

// ─── Ponderaciones y control de cambios ───────────────────────────────────────

matrixRouter.get('/versions', async (_req, res) => {
  const [versions, current] = await Promise.all([
    prisma.weightVersion.findMany({ orderBy: { id: 'desc' }, include: { createdBy: userSelect, reviewedBy: userSelect } }),
    currentVersion(),
  ]);
  res.json({ currentId: current?.id ?? null, versions });
});

matrixRouter.post('/versions', requirePermission('weights.propose'), async (req, res) => {
  const body = z.object({ weights: weightsSchema, reason: z.string().trim().min(10).max(500) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: firstError(body.error) });

  const pending = await prisma.weightVersion.count({ where: { status: 'PROPUESTA' } });
  if (pending) return res.status(409).json({ error: 'Ya hay una propuesta pendiente de revisión' });

  const version = await prisma.weightVersion.create({
    data: { version: await nextVersionName(), weights: body.data.weights, reason: body.data.reason, createdById: req.user!.id },
  });
  await audit(req, 'WEIGHTS_PROPOSE', { detail: `${version.version}: ${JSON.stringify(body.data.weights)}` });
  res.status(201).json(version);
});

// Segregación de funciones: revisa el Auditor/QA (RACI: una sola A), y nunca su propia propuesta.
async function review(req: Request, approve: boolean) {
  const id = Number(req.params.id);
  const note = z.string().trim().min(5).max(500).safeParse(req.body?.note);
  if (!note.success) return { status: 400, body: { error: 'Escribe una nota de revisión (mínimo 5 caracteres)' } };

  const version = await prisma.weightVersion.findUnique({ where: { id } });
  if (!version) return { status: 404, body: { error: 'Versión no encontrada' } };
  if (version.status !== 'PROPUESTA') return { status: 409, body: { error: 'Esta versión ya fue revisada' } };
  if (version.createdById === req.user!.id) {
    await audit(req, 'WEIGHTS_SELF_REVIEW_DENIED', { detail: version.version });
    return { status: 403, body: { error: 'No puedes revisar una propuesta creada por ti (segregación de funciones)' } };
  }

  const updated = await prisma.weightVersion.update({
    where: { id },
    data: { status: approve ? 'APROBADA' : 'RECHAZADA', reviewedById: req.user!.id, reviewedAt: new Date(), reviewNote: note.data },
  });
  await audit(req, approve ? 'WEIGHTS_APPROVE' : 'WEIGHTS_REJECT', { detail: `${version.version}: ${note.data}` });
  return { status: 200, body: updated };
}

matrixRouter.post('/versions/:id/approve', requirePermission('weights.approve'), async (req, res) => {
  const r = await review(req, true);
  res.status(r.status).json(r.body);
});

matrixRouter.post('/versions/:id/reject', requirePermission('weights.approve'), async (req, res) => {
  const r = await review(req, false);
  res.status(r.status).json(r.body);
});

// ─── Sensibilidad ─────────────────────────────────────────────────────────────

// Compara el riesgo inherente y el orden con la versión vigente vs. un escenario de pesos.
matrixRouter.post('/sensitivity', async (req, res) => {
  const body = z.object({ weights: weightsSchema }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: firstError(body.error) });
  const version = await currentVersion();
  if (!version) return res.status(404).json({ error: 'No hay una versión aprobada' });

  const events = await prisma.riskEvent.findMany({ include: { adjustments: true } });
  const calc = (w: Weights) =>
    events
      .map(e => ({ code: e.code, inherent: computeScore(e.scores as Scores, e.adjustments, w).inherent }))
      .sort((a, b) => b.inherent - a.inherent || a.code.localeCompare(b.code));

  const base = calc(version.weights as Weights);
  const scenario = calc(body.data.weights);
  const rows = base.map((b, i) => {
    const sIdx = scenario.findIndex(s => s.code === b.code);
    const e = events.find(x => x.code === b.code)!;
    return {
      code: b.code,
      description: e.description,
      base: b.inherent,
      scenario: scenario[sIdx].inherent,
      baseRank: i + 1,
      scenarioRank: sIdx + 1,
    };
  });
  await audit(req, 'SENSITIVITY_RUN', { detail: JSON.stringify(body.data.weights) });
  res.json({ version: version.version, rows, orderChanged: rows.some(r => r.baseRank !== r.scenarioRank) });
});

// ─── Apoyo: verificar cliente en listas restrictivas ─────────────────────────

matrixRouter.get('/screen', async (req, res) => {
  const name = z.string().trim().min(3).max(120).safeParse(req.query.name);
  if (!name.success) return res.status(400).json({ error: 'Escribe al menos 3 caracteres' });

  const matches = await screenName(name.data);
  await audit(req, 'RISK_SCREEN', { detail: `"${name.data}": ${matches.length} coincidencias` });
  res.json({ matches });
});
