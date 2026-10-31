// Sincroniza desde la terminal: npm run sync -- sanctions   |   npm run sync -- all
import { isListKey } from '../config/lists';
import { syncAll, syncList } from '../services/syncList';
import { prisma } from '../db';

const arg = process.argv[2] ?? 'all';

try {
  if (arg === 'all') await syncAll();
  else if (isListKey(arg)) await syncList(arg);
  else throw new Error(`Lista desconocida "${arg}". Usa: debarment | peps | sanctions | crime | all`);
} finally {
  await prisma.$disconnect();
}
