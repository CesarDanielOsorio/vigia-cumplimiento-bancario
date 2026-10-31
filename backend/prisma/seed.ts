import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { LISTS } from '../src/config/lists';
import { DEFAULT_WEIGHTS, type Scores, type Weights } from '../src/config/riskMatrix';
import { computeScore, rank } from '../src/services/riskScore';

const prisma = new PrismaClient();

async function upsertUser(username: string, fullName: string, role: Role, password: string | undefined) {
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    console.log(`  · usuario ${username} ya existe (no se modifica)`);
    return exists;
  }
  if (!password) throw new Error(`Define la contraseña de "${username}" en backend/.env`);
  const user = await prisma.user.create({
    data: { username, fullName, role, passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`  · usuario ${username} (${role}) creado`);
  return user;
}

// Eventos sintéticos: un caso por nivel (Prueba 2 del proyecto) + uno con datos faltantes.
// Con los pesos v1.1 reproducen el tablero del enunciado: EV-002 = 77, EV-001 = 55, EV-004 = 35, EV-003 = 12.
const EVENTS = [
  {
    code: 'EV-001',
    description: 'Depósitos en efectivo justo bajo el umbral de reporte, en tres sucursales durante una semana',
    clientName: 'Distribuidora Ficticia Alfa, S.A.',
    product: 'Cuenta monetaria (efectivo)', channel: 'Ventanilla en 3 sucursales', country: 'Guatemala',
    amount: 9800, currency: 'USD',
    scores: { monto: 4, frecuencia: 4, producto: 3, canal: 1, jurisdiccion: 3, perfil: 4, pep: 0 },
    adjustments: [
      { type: 'CONTROL', description: 'Monitoreo transaccional automatizado', points: 3 },
      { type: 'CONTROL', description: 'Revisión del oficial de cumplimiento', points: 2 },
    ],
  },
  {
    code: 'EV-002',
    description: 'Transferencias internacionales repetidas a jurisdicción de alto riesgo; cliente con vínculo PEP',
    clientName: 'Inversiones Sintéticas Beta, S.A.',
    product: 'Transferencia internacional', channel: 'Banca en línea', country: 'Jurisdicción de alto riesgo (GAFI)',
    amount: 250000, currency: 'USD',
    scores: { monto: 4, frecuencia: 3, producto: 4, canal: 3, jurisdiccion: 5, perfil: 4, pep: 5 },
    adjustments: [
      { type: 'CONTROL', description: 'Doble validación de la operación', points: 2 },
      { type: 'CONTROL', description: 'Debida diligencia reforzada (DDR) aplicada', points: 2 },
    ],
  },
  {
    code: 'EV-003',
    description: 'Pago de nómina con monto habitual y perfil coherente',
    clientName: 'Empresa Ficticia Gamma, S.A.',
    product: 'Pago de nómina', channel: 'Banca empresarial verificada', country: 'Guatemala',
    amount: 85000, currency: 'GTQ',
    scores: { monto: 1, frecuencia: 1, producto: 0, canal: 2, jurisdiccion: 0, perfil: 1, pep: 0 },
    adjustments: [{ type: 'CONTROL', description: 'Expediente KYC actualizado', points: 2 }],
  },
  {
    code: 'EV-004',
    description: 'Remesas familiares con aumento moderado frente al histórico del cliente',
    clientName: 'Persona Ficticia Delta',
    product: 'Remesa familiar', channel: 'Agente bancario', country: 'Estados Unidos → Guatemala',
    amount: 1500, currency: 'USD',
    scores: { monto: 2, frecuencia: 3, producto: 2, canal: 2, jurisdiccion: 2, perfil: 2, pep: 0 },
    adjustments: [
      { type: 'CONTROL', description: 'Límite transaccional por producto', points: 2 },
      { type: 'CONTROL', description: 'Verificación de identidad presencial', points: 2 },
    ],
  },
  {
    code: 'EV-005',
    description: 'Compra de divisas por monto alto sin información de actividad económica ni historial de frecuencia',
    clientName: 'Persona Ficticia Épsilon',
    product: 'Compra de divisas', channel: 'Ventanilla', country: 'Guatemala',
    amount: 45000, currency: 'USD',
    scores: { monto: 4, frecuencia: null, producto: 3, canal: 1, jurisdiccion: 1, perfil: null, pep: 0 },
    adjustments: [
      { type: 'CONTROL', description: 'Verificación de identidad presencial', points: 2 },
      { type: 'AGRAVANTE', description: 'Cliente se negó a declarar origen de fondos', points: 6 },
    ],
  },
];

async function main() {
  console.log('Listas:');
  for (const l of LISTS) {
    await prisma.sanctionList.upsert({
      where: { key: l.key },
      update: { name: l.name },
      create: { key: l.key, name: l.name },
    });
    console.log(`  · ${l.key}`);
  }

  // Un usuario por rol del equipo (enunciado y RACI) más el administrador del sistema.
  console.log('Usuarios:');
  await upsertUser('admin', 'Administrador del Sistema', Role.ADMIN, process.env.SEED_ADMIN_PASSWORD);
  const lider = await upsertUser('lider', 'Líder de Proyecto', Role.LIDER, process.env.SEED_LIDER_PASSWORD);
  const analyst = await upsertUser('analista', 'Analista de Riesgo', Role.ANALISTA_RIESGO, process.env.SEED_ANALYST_PASSWORD);
  const datos = await upsertUser('datos', 'Analista de Datos', Role.ANALISTA_DATOS, process.env.SEED_DATOS_PASSWORD);
  await upsertUser('bi', 'Desarrollador BI', Role.DESARROLLADOR_BI, process.env.SEED_BI_PASSWORD);
  const auditor = await upsertUser('auditor', 'Auditor / QA', Role.AUDITOR, process.env.SEED_AUDITOR_PASSWORD);

  console.log('Matriz LA/FT:');
  if ((await prisma.weightVersion.count()) === 0) {
    const day = 86400000;
    const now = Date.now();
    await prisma.weightVersion.create({
      data: {
        version: 'v1.0', weights: DEFAULT_WEIGHTS, status: 'APROBADA',
        reason: V10_REASON,
        createdById: lider.id, createdAt: new Date(now - 14 * day),
        reviewedById: auditor.id, reviewedAt: new Date(now - 13 * day),
        reviewNote: 'Pesos coherentes con el enfoque basado en riesgo. Aprobado.',
      },
    });
    await prisma.weightVersion.create({
      data: {
        version: 'v1.1', weights: DEFAULT_WEIGHTS, status: 'APROBADA',
        reason: V11_REASON,
        createdById: datos.id, createdAt: new Date(now - 2 * day),
        reviewedById: auditor.id, reviewedAt: new Date(now - day),
        reviewNote: 'Regla validada con el caso EV-005. Aprobado.',
      },
    });
    console.log('  · versiones v1.0 y v1.1 creadas');
  } else {
    // Bases creadas antes de los roles del RACI: los autores pasan a ser los del enunciado
    // (v1.0 · líder de proyecto, v1.1 · analista de datos). Solo toca las versiones del seed.
    await prisma.weightVersion.updateMany({ where: { version: 'v1.0', reason: V10_REASON }, data: { createdById: lider.id } });
    await prisma.weightVersion.updateMany({ where: { version: 'v1.1', reason: V11_REASON }, data: { createdById: datos.id } });
    console.log('  · versiones ya existen');
  }

  if ((await prisma.riskEvent.count()) === 0) {
    for (const e of EVENTS) {
      const { adjustments, amount, ...data } = e;
      await prisma.riskEvent.create({
        data: {
          ...data,
          amount: new Prisma.Decimal(amount),
          createdById: analyst.id,
          adjustments: { create: adjustments },
        },
      });
    }
    console.log(`  · ${EVENTS.length} eventos sintéticos creados`);
  } else console.log('  · eventos ya existen');

  await seedIncidents({ analyst: analyst.id, datos: datos.id, auditor: auditor.id });
}

const V10_REASON = 'Pesos iniciales del diccionario de factores';
const V11_REASON = 'Se agrega la regla de dato faltante: puntaje conservador de 3 y marca visible';

// Incidencias de ejemplo del seguimiento de datos incorrectos:
// INC-001 cerrada (el ejemplo del registro del equipo) e INC-002 recién registrada para recorrer el flujo.
async function seedIncidents(u: { analyst: number; datos: number; auditor: number }) {
  if ((await prisma.dataIncident.count()) > 0) return console.log('  · incidencias ya existen');

  const v11 = await prisma.weightVersion.findUnique({ where: { version: 'v1.1' } });
  const ev4 = await prisma.riskEvent.findUnique({ where: { code: 'EV-004' } });
  const ev5 = await prisma.riskEvent.findUnique({ where: { code: 'EV-005' } });
  if (!v11?.reviewedAt || !ev4 || !ev5) return console.log('  · faltan la versión v1.1 o los eventos EV-004/EV-005');

  const events = await prisma.riskEvent.findMany({ include: { adjustments: true } });
  const ranking = (override?: { code: string; scores: Scores }) =>
    rank(events.map(e => ({
      code: e.code,
      score: computeScore(e.code === override?.code ? override.scores : (e.scores as Scores), e.adjustments, v11.weights as Weights),
    })));
  const position = (r: ReturnType<typeof ranking>, code: string) => {
    const i = r.findIndex(e => e.code === code);
    return { rank: i + 1, residual: r[i].score.residual, ranking: r.map(e => e.code) };
  };

  // INC-001: el monto de la remesa EV-004 llegó vacío y se aplicó el puntaje conservador de 3.
  // Es posterior a v1.1, que es la versión que introdujo la regla de dato faltante.
  const hour = 3600000;
  const t0 = v11.reviewedAt.getTime() + hour;
  const at = (h: number) => new Date(Math.min(t0 + h * hour, Date.now() - hour));
  const ev4Scores = ev4.scores as Scores;
  const before = position(ranking({ code: 'EV-004', scores: { ...ev4Scores, monto: null } }), 'EV-004');
  const after = position(ranking(), 'EV-004');
  const desc1 = 'Monto vacío en remesa; se aplicó puntaje 3 (dato faltante)';
  await prisma.dataIncident.create({
    data: {
      code: 'INC-001', eventId: ev4.id, factor: 'monto', description: desc1, status: 'CERRADA',
      detectedById: u.analyst, detectedAt: at(0),
      residualBefore: before.residual, rankBefore: before.rank, rankingBefore: before.ranking,
      cause: 'CAPTURA', diagnosis: 'El archivo de remesas no traía el monto; el dato existe en el comprobante del agente.', diagnosedById: u.datos,
      correction: 'Se capturó el monto del comprobante (USD 1,500, habitual para el perfil): puntaje 2.', correctedById: u.analyst,
      scoreChange: { factor: 'monto', from: null, to: ev4Scores.monto },
      residualAfter: after.residual, rankAfter: after.rank, orderImpact: before.ranking.join() !== after.ranking.join(),
      revalidation: 'Se reproduce factor por factor: 8 + 9 + 4 + 4 + 8 + 6 + 0 = 39; residual 35.', revalidatedById: u.datos,
      approvalNote: 'Evidencia completa; el orden de atención no cambió.', approvedById: u.auditor,
      versionId: v11.id, closedAt: at(24),
      activities: {
        create: [
          { userId: u.analyst, step: 'REGISTRO', createdAt: at(0), note: `Factor Monto: ${desc1}. Residual al detectar: ${before.residual} (posición ${before.rank}.º).` },
          { userId: u.datos, step: 'DIAGNOSTICO', createdAt: at(1), note: 'Causa: error de captura. El archivo de remesas no traía el monto; el dato existe en el comprobante del agente.' },
          { userId: u.analyst, step: 'CORRECCION', createdAt: at(2), note: `Monto: sin dato → ${ev4Scores.monto}. Se capturó el monto del comprobante (USD 1,500, habitual para el perfil).` },
          { userId: u.datos, step: 'REVALIDACION', createdAt: at(4), note: `Score recalculado factor por factor con v1.1: residual ${before.residual} → ${after.residual}, posición ${before.rank}.º → ${after.rank}.º. Impacto en el orden: No. Se reproduce: 8 + 9 + 4 + 4 + 8 + 6 + 0 = 39.` },
          { userId: u.auditor, step: 'CIERRE', createdAt: at(24), note: 'Evidencia aprobada y archivada. Versión resultante: v1.1. El orden de atención no cambió.' },
        ],
      },
    },
  });

  // INC-002: la jurisdicción de EV-005 se calificó como nacional, pero las divisas van a una de alto riesgo.
  // Si se corrige a 4, EV-005 sube del 3.º al 2.º lugar: sirve para demostrar el aviso al patrocinador.
  const now = position(ranking(), 'EV-005');
  const desc2 = 'Jurisdicción calificada 1 (país de la región), pero el formulario indica que las divisas se enviarán a una jurisdicción de alto riesgo.';
  await prisma.dataIncident.create({
    data: {
      code: 'INC-002', eventId: ev5.id, factor: 'jurisdiccion', description: desc2,
      detectedById: u.analyst, detectedAt: new Date(Date.now() - 2 * hour),
      residualBefore: now.residual, rankBefore: now.rank, rankingBefore: now.ranking,
      activities: {
        create: {
          userId: u.analyst, step: 'REGISTRO', createdAt: new Date(Date.now() - 2 * hour),
          note: `Factor Jurisdicción: ${desc2} Residual al detectar: ${now.residual} (posición ${now.rank}.º).`,
        },
      },
    },
  });
  console.log('  · incidencias de ejemplo: INC-001 cerrada, INC-002 registrada');
}

main().finally(() => prisma.$disconnect());
