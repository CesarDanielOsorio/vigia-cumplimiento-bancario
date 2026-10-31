import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { listsRouter } from './routes/lists';
import { matrixRouter } from './routes/matrix';
import { incidentsRouter } from './routes/incidents';
import { adminRouter } from './routes/admin';
import { requireAuth } from './middleware/auth';
import { resetStuckSyncs } from './services/syncList';

z.config(z.locales.es()); // mensajes de validación en español

const app = express();

app.set('trust proxy', 'loopback'); // el proxy de Vite corre en la misma máquina
app.disable('x-powered-by');
app.use(helmet()); // cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.)
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/lists', requireAuth, listsRouter);
app.use('/api/matrix', requireAuth, matrixRouter);
app.use('/api/incidents', requireAuth, incidentsRouter);
app.use('/api/admin', requireAuth, adminRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Nunca se envía el stack trace al cliente.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

await resetStuckSyncs();
app.listen(env.port, '127.0.0.1', () => {
  console.log(`API escuchando en http://127.0.0.1:${env.port}`);
});
