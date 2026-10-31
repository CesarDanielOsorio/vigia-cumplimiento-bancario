import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (revisa backend/.env)`);
  return v;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  // Duración de la sesión en minutos
  sessionMinutes: Number(process.env.SESSION_MINUTES ?? 30),
  // Bloqueo de cuenta
  maxFailedAttempts: Number(process.env.MAX_FAILED_ATTEMPTS ?? 5),
  lockMinutes: Number(process.env.LOCK_MINUTES ?? 15),
  isProd: process.env.NODE_ENV === 'production',
};
