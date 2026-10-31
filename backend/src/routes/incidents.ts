import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma, type IncidentStatus } from '@prisma/client';
import { prisma } from '../db';
import { requirePermission } from '../middleware/auth';
import { PERMISSIONS, ROLE_LABEL, can, correctPermission, type Permission } from '../config/permissions';
import { FACTOR_KEYS, FACTORS, type FactorKey, type Scores, type Weights } from '../config/riskMatrix';
import { audit, type AuditAction } from '../services/audit';
import { currentVersion, scoredEvents, userSelect } from '../services/matrixData';
import { getSettings } from '../services/settings';

// Seguimiento de datos incorrectos según la matriz RACI del equipo:
// detección y registro → diagnóstico → corrección → revalidación → (aviso al patrocinador) → cierre.
export const incidentsRouter = Router();

const DAY = 86400000;
const STATUSES: IncidentStatus[] = ['REGISTRADA', 'DIAGNOSTICADA', 'CORREGIDA', 'REVALIDADA', 'CERRADA'];
const OPEN: IncidentStatus[] = STATUSES.filter(s => s !== 'CERRADA');

const include = {
  event: { select: { code: true, description: true } },
  detectedBy: userSelect,
  diagnosedBy: userSelect,
  correctedBy: userSelect,
  revalidatedBy: userSelect,
  sponsorInformedBy: userSelect,
  approvedBy: userSelect,
  version: { select: { id: true, version: true, status: true } },
} satisfies Prisma.DataIncidentInclude;

type IncidentRow = Prisma.DataIncidentGetPayload<{ include: typeof include }>;

const factorLabel = (k: string | null) => (k ? (FACTORS.find(f => f.key === k)?.label ?? k) : null);
const daysOpen = (i: { detectedAt: Date; closedAt: Date | null }) =>
  Math.floor(((i.closedAt ?? new Date()).getTime() - i.detectedAt.getTime()) / DAY);

// Qué paso sigue y quién puede darlo (según la tabla de permisos).
function nextStep(i: Pick<IncidentRow, 'status' | 'cause' | 'orderImpact' | 'sponsorInformedAt'>) {
  const step = (key: string, permission: Permission, label: string) => ({ key, permission, label, roles: PERMISSIONS[permission].roles });
  switch (i.status) {
    case 'REGISTRADA': return step('diagnose', 'incidents.diagnose', 'Clasificar la causa');
    case 'DIAGNOSTICADA': return step('correct', correctPermission(i.cause!), PERMISSIONS[correctPermission(i.cause!)].label);
    case 'CORREGIDA': return step('revalidate', 'incidents.revalidate', 'Revalidar el score');
    case 'REVALIDADA':
      return i.orderImpact && !i.sponsorInformedAt
        ? step('sponsor', 'incidents.sponsor', 'Informar al patrocinador')
        : step('close', 'incidents.close', 'Aprobar y cerrar');
    default: return null;
  }
}

function present(i: IncidentRow, slaDays: number) {
  const { rankingBefore: _ranking, ...rest } = i;
  const days = daysOpen(i);
  return {
    ...rest,
    factorLabel: factorLabel(i.factor),
    daysOpen: days,
    overdue: i.status !== 'CERRADA' && days > slaDays,
    next: nextStep(i),
  };
}

// Pesos con los que se evalúa la incidencia: la versión propuesta si la causa es una regla; si no, la vigente.
async function weightsFor(i: { cause: string | null; versionId: number | null }) {
  const v = i.cause === 'REGLA' && i.versionId
    ? await prisma.weightVersion.findUnique({ where: { id: i.versionId } })
    : await currentVersion();
  if (!v) throw new Error('No hay una versión de ponderaciones aprobada');
  return { id: v.id, version: v.version, weights: v.weights as Weights };
}

// Posición del evento en el orden de atención. `only` limita la comparación a los eventos
// que existían al detectar el dato incorrecto (los registrados después no cuentan como impacto).
async function snapshot(code: string, weights: Weights, only?: string[]) {
  let ranked = await scoredEvents(weights);
  if (only) ranked = ranked.filter(e => only.includes(e.code));
  const idx = ranked.findIndex(e => e.code === code);
  return { ranking: ranked.map(e => e.code), rank: idx + 1, residual: ranked[idx].score.residual, score: ranked[idx].score };
}

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? 'Datos inválidos';
const noteSchema = (min: number, what: string) =>
  z.string().trim().min(min, `${what} debe tener al menos ${min} caracteres`).max(1000);

// ─── Consulta ─────────────────────────────────────────────────────────────────

incidentsRouter.get('/', async (_req, res) => {
  const [{ incidentSlaDays }, rows, current] = await Promise.all([
    getSettings(),
    prisma.dataIncident.findMany({ include, orderBy: { id: 'desc' } }),
    currentVersion(),
  ]);
  const incidents = rows.map(i => present(i, incidentSlaDays));

  // Detección: eventos que la matriz marca con «dato faltante».
  const events = current ? await scoredEvents(current.weights as Weights) : [];
  const missing = events
    .filter(e => e.score.missingCount > 0)
    .map(e => {
      const factors = e.score.factors.filter(f => f.missing).map(f => ({ key: f.key, label: f.label }));
      // Solo cuenta una incidencia abierta sobre alguno de los factores sin dato.
      const open = incidents.find(i =>
        i.event.code === e.code && OPEN.includes(i.status) && factors.some(f => f.key === i.factor));
      return { code: e.code, description: e.description, factors, openIncident: open?.code ?? null };
    });

  res.json({
    incidents,
    stats: {
      byStatus: Object.fromEntries(STATUSES.map(s => [s, incidents.filter(i => i.status === s).length])),
      overdue: incidents.filter(i => i.overdue).length,
      withImpact: incidents.filter(i => i.orderImpact).length,
    },
    missing,
    events: events.map(e => ({ code: e.code, description: e.description })),
    slaDays: incidentSlaDays,
  });
});

incidentsRouter.get('/:code', async (req, res) => {
  const i = await prisma.dataIncident.findUnique({
    where: { code: String(req.params.code) },
    include: {
      ...include,
      event: true,
      activities: { orderBy: { createdAt: 'asc' }, include: { user: userSelect } },
    },
  });
  if (!i) return res.status(404).json({ error: 'Incidencia no encontrada' });

  const { incidentSlaDays } = await getSettings();
  const used = await weightsFor(i);
  const now = await snapshot(i.event.code, used.weights, i.rankingBefore as string[]);

  // Para una regla: versiones propuestas o aprobadas después de detectar el dato, que se pueden vincular.
  const candidates = i.status === 'DIAGNOSTICADA' && i.cause === 'REGLA'
    ? await prisma.weightVersion.findMany({
        where: { status: { in: ['PROPUESTA', 'APROBADA'] }, createdAt: { gte: i.detectedAt } },
        select: { id: true, version: true, status: true, reason: true },
        orderBy: { id: 'desc' },
      })
    : [];

  const { activities, event, rankingBefore, ...rest } = i;
  res.json({
    ...present({ ...rest, rankingBefore, event: { code: event.code, description: event.description } }, incidentSlaDays),
    event: {
      code: event.code, description: event.description, clientName: event.clientName, product: event.product,
      channel: event.channel, country: event.country, scores: event.scores,
    },
    rankingBefore,
    evaluation: { version: used.version, ranking: now.ranking, rank: now.rank, residual: now.residual, score: now.score },
    candidates,
    activities,
  });
});

// ─── Flujo ────────────────────────────────────────────────────────────────────

async function load(req: Request, res: Response) {
  const i = await prisma.dataIncident.findUnique({ where: { code: String(req.params.code) }, include: { event: true } });
  if (!i) res.status(404).json({ error: 'Incidencia no encontrada' });
  return i;
}

function expect(res: Response, i: { status: IncidentStatus }, status: IncidentStatus, msg: string) {
  if (i.status === status) return true;
  res.status(409).json({ error: msg });
  return false;
}

// Segregación de funciones: quien corrige no valida ni aprueba su propia corrección.
async function denySelf(req: Request, res: Response, code: string, userIds: (number | null)[], msg: string) {
  if (!userIds.includes(req.user!.id)) return false;
  await audit(req, 'INCIDENT_SOD_DENIED', { detail: `${code}: ${msg}` });
  res.status(403).json({ error: `${msg} (segregación de funciones)` });
  return true;
}

// Cambia la incidencia y deja el paso en el expediente y en la bitácora de auditoría, todo junto.
async function transition(
  req: Request,
  incidentId: number,
  code: string,
  data: Prisma.DataIncidentUpdateInput,
  activity: { step: string; note: string },
  action: AuditAction,
  extra: Prisma.PrismaPromise<unknown>[] = [],
) {
  await prisma.$transaction([
    ...extra,
    prisma.dataIncident.update({ where: { id: incidentId }, data }),
    prisma.incidentActivity.create({ data: { incidentId, userId: req.user!.id, ...activity } }),
  ]);
  await audit(req, action, { detail: `${code}: ${activity.note}`.slice(0, 500) });
}

// 1-2. Detección y registro (R: analista de riesgo / analista de datos).
const registerSchema = z.object({
  eventCode: z.string().trim().regex(/^EV-\d{3,}$/, 'Elige un evento'),
  factor: z.enum(FACTOR_KEYS).nullable(),
  description: noteSchema(10, 'La descripción'),
});

incidentsRouter.post('/', requirePermission('incidents.register'), async (req, res) => {
  const body = registerSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: firstError(body.error) });
  const { eventCode, factor, description } = body.data;

  const event = await prisma.riskEvent.findUnique({ where: { code: eventCode } });
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
  const dup = await prisma.dataIncident.findFirst({ where: { eventId: event.id, factor, status: { in: OPEN } } });
  if (dup) return res.status(409).json({ error: `Ya hay una incidencia abierta para ese evento y factor (${dup.code})` });

  const version = await currentVersion();
  if (!version) return res.status(404).json({ error: 'No hay una versión de ponderaciones aprobada' });
  const before = await snapshot(eventCode, version.weights as Weights);

  const last = await prisma.dataIncident.findFirst({ orderBy: { id: 'desc' }, select: { code: true } });
  const code = `INC-${String((Number(last?.code.split('-')[1]) || 0) + 1).padStart(3, '0')}`;
  const note = `${factor ? `Factor ${factorLabel(factor)}: ` : ''}${description} Residual al detectar: ${before.residual} (posición ${before.rank}.º).`;

  await prisma.dataIncident.create({
    data: {
      code, eventId: event.id, factor, description, detectedById: req.user!.id,
      residualBefore: before.residual, rankBefore: before.rank, rankingBefore: before.ranking,
      activities: { create: { userId: req.user!.id, step: 'REGISTRO', note } },
    },
  });
  await audit(req, 'INCIDENT_REGISTER', { detail: `${code} (${eventCode}): ${description}`.slice(0, 500) });
  res.status(201).json({ code });
});

// 3. Diagnóstico: el analista de datos clasifica la causa (A: líder de proyecto).
const CAUSE_LABEL = { CAPTURA: 'error de captura', REGLA: 'regla o ponderación', CALCULO: 'cálculo o visualización' } as const;

incidentsRouter.post('/:code/diagnose', requirePermission('incidents.diagnose'), async (req, res) => {
  const body = z.object({
    cause: z.enum(['CAPTURA', 'REGLA', 'CALCULO']),
    factor: z.enum(FACTOR_KEYS).nullable().optional(),
    note: noteSchema(10, 'El diagnóstico'),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: firstError(body.error) });
  const i = await load(req, res);
  if (!i || !expect(res, i, 'REGISTRADA', 'La incidencia ya fue diagnosticada')) return;

  const factor = body.data.factor ?? i.factor;
  if (body.data.cause === 'CAPTURA' && !factor) {
    return res.status(400).json({ error: 'Para un error de captura indica qué factor está mal' });
  }
  await transition(
    req, i.id, i.code,
    { status: 'DIAGNOSTICADA', cause: body.data.cause, factor, diagnosis: body.data.note, diagnosedBy: { connect: { id: req.user!.id } } },
    { step: 'DIAGNOSTICO', note: `Causa: ${CAUSE_LABEL[body.data.cause]}. ${body.data.note}` },
    'INCIDENT_DIAGNOSE',
  );
  res.json({ ok: true });
});

// 4. Corrección según la causa: captura → analista de riesgo, regla → analista de datos, cálculo → BI.
incidentsRouter.post('/:code/correct', async (req, res) => {
  const body = z.object({
    note: noteSchema(10, 'La descripción de la corrección'),
    newScore: z.number().int().min(0).max(5).optional(),
    versionId: z.number().int().positive().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: firstError(body.error) });
  const i = await load(req, res);
  if (!i || !expect(res, i, 'DIAGNOSTICADA', 'La incidencia no está lista para corregirse')) return;
  if (!can(req.user!.role, correctPermission(i.cause!))) {
    const who = PERMISSIONS[correctPermission(i.cause!)].roles.filter(r => r !== 'ADMIN').map(r => ROLE_LABEL[r]).join(' o ');
    return res.status(403).json({ error: `Según el RACI, esta corrección le toca a: ${who}` });
  }

  const data: Prisma.DataIncidentUpdateInput = { correction: body.data.note, correctedBy: { connect: { id: req.user!.id } }, status: 'CORREGIDA' };
  const extra: Prisma.PrismaPromise<unknown>[] = [];
  let note = body.data.note;

  if (i.cause === 'CAPTURA') {
    if (body.data.newScore === undefined) return res.status(400).json({ error: 'Indica el puntaje correcto del factor (0 a 5)' });
    const scores = i.event.scores as Scores;
    const key = i.factor as FactorKey;
    const from = scores[key];
    if (from === body.data.newScore) return res.status(400).json({ error: 'El puntaje corregido es igual al actual' });
    data.scoreChange = { factor: key, from, to: body.data.newScore };
    extra.push(prisma.riskEvent.update({ where: { id: i.eventId }, data: { scores: { ...scores, [key]: body.data.newScore } } }));
    note = `${factorLabel(key)}: ${from ?? 'sin dato'} → ${body.data.newScore}. ${note}`;
  }

  if (i.cause === 'REGLA') {
    const v = body.data.versionId ? await prisma.weightVersion.findUnique({ where: { id: body.data.versionId } }) : null;
    if (!v || v.status === 'RECHAZADA' || v.createdAt < i.detectedAt) {
      return res.status(400).json({ error: 'Vincula la versión de ponderaciones que propusiste para corregir la regla' });
    }
    data.version = { connect: { id: v.id } };
    note = `Ajuste de regla en la versión ${v.version} (${v.status === 'APROBADA' ? 'aprobada' : 'pendiente de aprobación del Auditor/QA'}). ${note}`;
  }

  await transition(req, i.id, i.code, data, { step: 'CORRECCION', note }, 'INCIDENT_CORRECT', extra);
  res.json({ ok: true });
});

// 5. Revalidación: se recalcula el score y se mide si cambió el orden de atención.
incidentsRouter.post('/:code/revalidate', requirePermission('incidents.revalidate'), async (req, res) => {
  const note = noteSchema(10, 'La nota de revalidación').safeParse(req.body?.note);
  if (!note.success) return res.status(400).json({ error: firstError(note.error) });
  const i = await load(req, res);
  if (!i || !expect(res, i, 'CORREGIDA', 'La incidencia no está corregida')) return;
  if (await denySelf(req, res, i.code, [i.correctedById], 'Quien corrige no revalida su propia corrección')) return;

  const used = await weightsFor(i);
  const before = i.rankingBefore as string[];
  const after = await snapshot(i.event.code, used.weights, before);
  const orderImpact = after.ranking.join() !== before.join();

  await transition(
    req, i.id, i.code,
    {
      status: 'REVALIDADA', residualAfter: after.residual, rankAfter: after.rank, orderImpact,
      revalidation: note.data, revalidatedBy: { connect: { id: req.user!.id } },
    },
    {
      step: 'REVALIDACION',
      note: `Score recalculado factor por factor con ${used.version}: residual ${i.residualBefore} → ${after.residual}, ` +
        `posición ${i.rankBefore}.º → ${after.rank}.º. Impacto en el orden: ${orderImpact ? 'Sí' : 'No'}. ${note.data}`,
    },
    'INCIDENT_REVALIDATE',
  );
  res.json({ ok: true, orderImpact });
});

// El Auditor/QA puede devolver la incidencia si la evidencia no basta: vuelve a corrección.
incidentsRouter.post('/:code/return', requirePermission('incidents.close'), async (req, res) => {
  const note = noteSchema(10, 'El motivo').safeParse(req.body?.note);
  if (!note.success) return res.status(400).json({ error: firstError(note.error) });
  const i = await load(req, res);
  if (!i || !expect(res, i, 'REVALIDADA', 'Solo se devuelve una incidencia revalidada')) return;
  await transition(
    req, i.id, i.code,
    {
      status: 'DIAGNOSTICADA', correction: null, correctedBy: { disconnect: true }, scoreChange: Prisma.DbNull,
      version: { disconnect: true }, residualAfter: null, rankAfter: null, orderImpact: null,
      revalidation: null, revalidatedBy: { disconnect: true },
      sponsorNote: null, sponsorInformedBy: { disconnect: true }, sponsorInformedAt: null,
    },
    { step: 'DEVUELTA', note: `Devuelta a corrección: ${note.data}` },
    'INCIDENT_RETURN',
  );
  res.json({ ok: true });
});

// 9. Si el dato incorrecto alteró el orden, el líder de proyecto informa al patrocinador.
incidentsRouter.post('/:code/sponsor', requirePermission('incidents.sponsor'), async (req, res) => {
  const note = noteSchema(10, 'El aviso').safeParse(req.body?.note);
  if (!note.success) return res.status(400).json({ error: firstError(note.error) });
  const i = await load(req, res);
  if (!i || !expect(res, i, 'REVALIDADA', 'La incidencia no está revalidada')) return;
  if (!i.orderImpact) return res.status(409).json({ error: 'No hubo impacto en el orden: no hace falta informar al patrocinador' });
  if (i.sponsorInformedAt) return res.status(409).json({ error: 'El patrocinador ya fue informado' });
  await transition(
    req, i.id, i.code,
    { sponsorNote: note.data, sponsorInformedBy: { connect: { id: req.user!.id } }, sponsorInformedAt: new Date() },
    { step: 'PATROCINADOR', note: `Se informa al patrocinador (VP de Cumplimiento): ${note.data}` },
    'INCIDENT_SPONSOR',
  );
  res.json({ ok: true });
});

// 6-8. Cierre: el Auditor/QA aprueba la evidencia (A). Si fue una regla, la versión debe estar aprobada.
incidentsRouter.post('/:code/close', requirePermission('incidents.close'), async (req, res) => {
  const note = noteSchema(10, 'La nota de aprobación').safeParse(req.body?.note);
  if (!note.success) return res.status(400).json({ error: firstError(note.error) });
  const i = await load(req, res);
  if (!i || !expect(res, i, 'REVALIDADA', 'La incidencia no está revalidada')) return;
  if (await denySelf(req, res, i.code, [i.correctedById, i.revalidatedById], 'No puedes aprobar una incidencia que corregiste o revalidaste')) return;
  if (i.orderImpact && !i.sponsorInformedAt) {
    return res.status(409).json({ error: 'Hubo impacto en el orden: primero el líder de proyecto debe informar al patrocinador' });
  }

  let versionId = i.versionId;
  if (i.cause === 'REGLA') {
    const v = await prisma.weightVersion.findUnique({ where: { id: i.versionId! } });
    if (v?.status !== 'APROBADA') {
      return res.status(409).json({ error: `La versión ${v?.version} aún no está aprobada en «Ponderaciones y cambios»` });
    }
  } else {
    versionId = (await currentVersion())?.id ?? null;
  }
  const version = versionId ? await prisma.weightVersion.findUnique({ where: { id: versionId } }) : null;

  await transition(
    req, i.id, i.code,
    {
      status: 'CERRADA', approvalNote: note.data, approvedBy: { connect: { id: req.user!.id } }, closedAt: new Date(),
      ...(versionId ? { version: { connect: { id: versionId } } } : {}),
    },
    { step: 'CIERRE', note: `Evidencia aprobada y archivada. Versión resultante: ${version?.version ?? '—'}. ${note.data}` },
    'INCIDENT_CLOSE',
  );
  res.json({ ok: true });
});
