import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { LISTS, OS_BASE, type ListKey } from '../config/lists';
import { fixMojibake, normalize, sortKey } from '../utils/normalize';

const BATCH_SIZE = 1000;
const split = (v?: string) => (v ? v.split(';').map(x => x.trim()).filter(Boolean) : []);

/**
 * Descarga y reindexa una lista.
 * Los registros nuevos se insertan con un batchId nuevo; solo cuando todo terminó bien se
 * borran los del lote anterior. Si la descarga falla, los datos anteriores siguen intactos.
 */
export async function syncList(key: ListKey) {
  const cfg = LISTS.find(l => l.key === key)!;
  const batchId = randomUUID();
  await prisma.sanctionList.update({ where: { key }, data: { syncStatus: 'running', syncError: null } });

  try {
    const changes: string[] = [];
    let total = 0;

    for (const ds of cfg.datasets) {
      const metaRes = await fetch(`${OS_BASE}/${ds}/index.json`);
      if (!metaRes.ok) throw new Error(`Metadatos de ${ds}: HTTP ${metaRes.status}`);
      const meta = (await metaRes.json()) as { last_change?: string };
      changes.push(`${ds}:${meta.last_change ?? ''}`);

      const res = await fetch(`${OS_BASE}/${ds}/targets.simple.csv`);
      if (!res.ok || !res.body) throw new Error(`Descarga de ${ds}: HTTP ${res.status}`);

      const parser = Readable.fromWeb(res.body as never).pipe(
        parse({ columns: true, relax_quotes: true, relax_column_count: true }),
      );
      let batch: Prisma.SanctionRecordCreateManyInput[] = [];

      for await (const row of parser as AsyncIterable<Record<string, string>>) {
        if (!row.id || !row.name) continue;
        const name = fixMojibake(row.name);
        const aliases = fixMojibake(row.aliases ?? '');
        const nameNorm = normalize(name);
        batch.push({
          entityId: row.id,
          listKey: key,
          batchId,
          dataset: row.dataset || ds,
          schema: row.schema || 'Thing',
          name,
          nameNorm,
          sortKey: sortKey(name, nameNorm),
          searchNorm: normalize(`${name} ${aliases.replaceAll(';', ' ')}`),
          aliases: split(aliases),
          birthDate: row.birth_date || null,
          countries: split(row.countries),
          identifiers: split(row.identifiers),
          sanctions: row.sanctions || null,
          firstSeen: row.first_seen || null,
          lastSeen: row.last_seen || null,
        });
        if (batch.length === BATCH_SIZE) {
          total += (await prisma.sanctionRecord.createMany({ data: batch, skipDuplicates: true })).count;
          batch = [];
        }
      }
      if (batch.length) total += (await prisma.sanctionRecord.createMany({ data: batch, skipDuplicates: true })).count;
      console.log(`[sync] ${key}/${ds} listo — acumulado ${total.toLocaleString('en-US')}`);
    }

    // Swap: el lote nuevo pasa a ser el vigente y se elimina el anterior.
    await prisma.$transaction([
      prisma.sanctionList.update({
        where: { key },
        data: { recordCount: total, lastSyncAt: new Date(), lastChange: changes.join('|'), syncStatus: 'idle', batchId },
      }),
      prisma.sanctionRecord.deleteMany({ where: { listKey: key, NOT: { batchId } } }),
    ]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[sync] ${key} falló:`, message);
    await prisma.sanctionRecord.deleteMany({ where: { listKey: key, batchId } });
    await prisma.sanctionList.update({ where: { key }, data: { syncStatus: 'error', syncError: message } });
    throw e;
  }
}

export async function syncAll() {
  // Secuencial para no saturar memoria ni la BD.
  for (const l of LISTS) {
    try {
      await syncList(l.key);
    } catch {
      /* el error ya quedó en la lista; se continúa con las demás */
    }
  }
}

// Si el servidor se reinicia a media sincronización, la lista no debe quedar "running" para siempre.
export async function resetStuckSyncs() {
  const stuck = await prisma.sanctionList.findMany({ where: { syncStatus: 'running' } });
  for (const l of stuck) {
    await prisma.sanctionRecord.deleteMany({ where: { listKey: l.key, NOT: { batchId: l.batchId ?? '' } } });
    await prisma.sanctionList.update({
      where: { key: l.key },
      data: { syncStatus: 'error', syncError: 'Sincronización interrumpida por reinicio del servidor' },
    });
  }
}
