# Vigía · Cumplimiento Bancario

Proyecto del curso **Seguridad y Auditoría de Sistemas**.
Autor: **Cesar Daniel Osorio Polanco** — Carné 0900-16-6607.

Aplicación web local con cuatro módulos:

1. **Listas Restrictivas Internacionales**: consulta de sanciones (OFAC, ONU, UE, UK), PEPs, empresas inhabilitadas por el Banco Mundial y personas buscadas. Los datos vienen de [OpenSanctions](https://www.opensanctions.org) (licencia CC BY-NC 4.0, uso académico).
2. **Matriz LA/FT** (Proyecto 2): matriz parametrizable que prioriza eventos sintéticos de riesgo de lavado de activos con 7 factores ponderados, riesgo inherente y residual, regla de dato faltante, control de cambios versionado con aprobación y prueba de sensibilidad.
3. **Seguimiento de incidencias**: gestión de datos incorrectos según la matriz RACI del equipo. Flujo detección → registro → diagnóstico → corrección → revalidación → cierre, con registro de incidencias, expediente inmutable, medición del impacto en el orden de atención y aviso al patrocinador.
4. **Administración**: bitácora de auditoría (administrador y Auditor/QA) y panel de configuración (usuarios, roles, permisos y parámetros de seguridad).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 + lucide-react |
| Backend | Node.js + Express 5 + TypeScript |
| Base de datos | PostgreSQL 16 + Prisma 6 |

## Instalación rápida (Windows 10/11)

1. Descarga el proyecto y abre **`Instalar Vigia.bat`** (doble clic).
2. El instalador revisa si tienes **Node.js 20.19+** y **PostgreSQL 14+**. Si falta alguno, te pregunta y lo instala desde su fuente oficial con winget (Windows pedirá permiso de administrador). PostgreSQL se instala solo con el motor, sin pgAdmin ni Stack Builder. No instala nada más.
3. Prepara Vigía: librerías del proyecto y una base de datos propia en `%LOCALAPPDATA%\Vigia` (puerto libre desde 5433, solo accesible desde tu PC), que no toca otras bases de datos ni necesita la contraseña de tu PostgreSQL.
4. Al final muestra los usuarios y contraseñas de **tu** computadora (cada instalación genera las suyas) y, si quieres, crea los accesos directos **Iniciar Vigia**, **Detener Vigia** y **Ver contrasenas** en el escritorio. Con **Ver contrasenas** puedes volver a consultarlas cuando quieras.
5. Abre **Iniciar Vigia**, entra como `admin` y en *Listas Internacionales* presiona **Sincronizar todas** (unos 10 minutos la primera vez).

Para desinstalar: borra la carpeta del proyecto y `%LOCALAPPDATA%\Vigia`. Node.js y PostgreSQL se quitan desde *Configuración → Aplicaciones*.

## Instalación manual

Requisitos: Node.js 20.19 o superior (recomendado 22 LTS) y PostgreSQL corriendo en `localhost:5432` con la contraseña del usuario `postgres`.

```powershell
npm install            # instala concurrently en la raíz
npm run install:all    # dependencias de backend y frontend
npm run setup:db       # pide la contraseña de postgres, crea BD, usuario, .env, migraciones y usuarios
npm run dev            # API en :4000 y web en http://127.0.0.1:5173
```

El instalador o `setup:db` muestran al final las contraseñas de los 6 usuarios (también quedan en `backend/.env`). Los roles son los del equipo del enunciado más el administrador del sistema:

| Usuario | Rol | Qué hace |
|---|---|---|
| `admin` | Administrador del sistema | Ve todas las vistas, configura usuarios y parámetros, sincroniza listas y puede ejecutar las tareas operativas. **No aprueba**: las aprobaciones son del Auditor/QA |
| `lider` | Líder de proyecto | Gobierno del trabajo: propone pesos (v1.0) e informa al patrocinador cuando hay impacto |
| `analista` | Analista de riesgo | Registra eventos e incidencias y corrige datos de escenario (captura) |
| `datos` | Analista de datos | Diagnostica la causa, ajusta ponderaciones o reglas y revalida el score |
| `bi` | Desarrollador BI | Corrige fórmulas o visualización |
| `auditor` | Auditor/QA | Aprueba versiones y cierra incidencias; consulta la bitácora |

La tabla completa de permisos está en `backend/src/config/permissions.ts` y se ve en **Configuración → Permisos por rol**.

### Descargar las listas

Desde la pantalla, con el usuario `admin`, usa **Sincronizar todas** o **Re-sincronizar** en cada tarjeta. También desde la terminal:

```powershell
npm run sync -- sanctions   # la más pequeña, buena para probar
npm run sync -- all         # todas (PEPs pesa varios cientos de MB)
```

## Controles de seguridad implementados

| Control | Dónde |
|---|---|
| Contraseñas con hash **bcrypt** (costo 12), nunca en claro | `backend/prisma/seed.ts`, `routes/auth.ts` |
| Sesión con **JWT** en cookie `httpOnly` + `SameSite=Strict` (mitiga XSS y CSRF) | `middleware/auth.ts` |
| Expiración de sesión (30 min por defecto, configurable de 5 a 240) | Configuración → Parámetros, `services/settings.ts` |
| **Bloqueo de cuenta** tras 5 intentos fallidos durante 15 min (configurable con límites) | `routes/auth.ts` |
| **Rate limiting** de login por IP (20 intentos / 15 min) | `routes/auth.ts` |
| Mensaje de error genérico y tiempo constante (evita enumeración de usuarios) | `routes/auth.ts` |
| **Control de acceso por permisos** (mínimo privilegio): una sola tabla de permisos que el servidor aplica en cada ruta y el frontend usa para mostrar u ocultar acciones | `config/permissions.ts`, `requirePermission` |
| **Bitácora de auditoría**: accesos, sincronizaciones, búsquedas, cambios de pesos, incidencias, usuarios y parámetros, con IP; la consultan el administrador y el Auditor/QA | tabla `AuditLog`, `services/audit.ts`, pantalla Bitácora |
| **Gestión de usuarios**: contraseña temporal fuerte mostrada una sola vez, desbloqueo, desactivación con efecto inmediato; nadie cambia su propio rol y siempre queda un administrador activo | `routes/admin.ts` |
| Validación de entradas con **zod** y consultas parametrizadas de Prisma (evita inyección SQL) | rutas |
| Cabeceras de seguridad con **helmet**, sin `x-powered-by`, límite de 10 KB al cuerpo JSON | `src/index.ts` |
| Errores internos sin stack trace hacia el cliente | `src/index.ts` |
| API escuchando solo en `127.0.0.1` | `src/index.ts` |
| Usuario de BD propio con privilegios mínimos (no `postgres`) y secretos aleatorios | `scripts/setup-db.ps1` |
| **Segregación de funciones**: solo el Auditor/QA aprueba versiones y nunca la propia propuesta; el intento queda en bitácora | `routes/matrix.ts` |
| **Control de cambios** de ponderaciones: quién, cuándo, por qué y quién aprobó | tabla `WeightVersion` |
| **Segregación en incidencias** (RACI): quien corrige no revalida ni aprueba su corrección; cada corrección la hace el rol que indica la causa | `routes/incidents.ts` |
| **Nada se corrige en silencio**: al revalidar se compara el orden de atención; si cambió, no se cierra sin el aviso del líder al patrocinador | `routes/incidents.ts` |
| **Expediente inmutable** por incidencia: cada paso queda con usuario y fecha | tabla `IncidentActivity` |
| Sincronización transaccional: si una descarga falla, los datos anteriores se conservan | `services/syncList.ts` |

Para revisar la bitácora:

```sql
SELECT "createdAt", username, action, detail, ip FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 50;
```

## Estructura

```
backend/
  prisma/            schema.prisma, migraciones, seed
  src/config/        listas, matriz, permisos por rol y variables de entorno
  src/middleware/    autenticación y permisos
  src/routes/        auth, listas, matriz, incidencias y administración
  src/services/      sincronización, auditoría, cálculo de la matriz y parámetros
frontend/src/
  pages/             Login, listas, matriz, incidencias, bitácora y configuración
  components/        layout, tarjetas, matriz, incidencias (RACI y flujo) y administración
  tours/             tours guiados de cada pantalla
  lib/               api, auth, roles, tour, timeAgo
scripts/setup-db.ps1
```

## Matriz LA/FT — cálculo

```
aporte     = peso × puntaje ÷ 5          (7 factores, puntaje 0..5, pesos suman 100)
inherente  = Σ aportes                   (0..100)
residual   = inherente − controles + agravantes
nivel      = BAJO 0–24 · MEDIO 25–49 · ALTO 50–74 · CRÍTICO 75–100
dato faltante → puntaje conservador 3 y marca visible
```

Los eventos sintéticos EV-001 a EV-004 reproducen el ejemplo del enunciado (residual 55, 77, 12 y 35; escenario B de sensibilidad: 58, 83, 12 y 39). EV-005 demuestra la regla de dato faltante y un agravante. El diccionario de factores está en `backend/src/config/riskMatrix.ts` y la fórmula en `backend/src/services/riskScore.ts`.
