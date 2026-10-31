import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';
import { LISTS } from '../src/config/lists';
import { DEFAULT_WEIGHTS } from '../src/config/riskMatrix';
import { EVENTS, V10_REASON, V11_REASON, eventData, seedIncidents } from '../src/services/demoData';

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
      await prisma.riskEvent.create({
        data: { ...eventData(e), createdById: analyst.id, adjustments: { create: e.adjustments } },
      });
    }
    console.log(`  · ${EVENTS.length} eventos sintéticos creados`);
  } else console.log('  · eventos ya existen');

  console.log(`  · ${await seedIncidents(prisma, { analyst: analyst.id, datos: datos.id, auditor: auditor.id })}`);
}

main().finally(() => prisma.$disconnect());
