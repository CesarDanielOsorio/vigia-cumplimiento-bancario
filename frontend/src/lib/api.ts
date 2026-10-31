export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(res.status, body.error ?? `Error ${res.status}`);
  }
  return body as T;
}

export type Role = 'ADMIN' | 'LIDER' | 'ANALISTA_RIESGO' | 'ANALISTA_DATOS' | 'DESARROLLADOR_BI' | 'AUDITOR';

// Permisos que el backend asigna a cada rol (backend/src/config/permissions.ts).
export type Permission =
  | 'lists.sync' | 'events.create' | 'weights.propose' | 'weights.approve'
  | 'incidents.register' | 'incidents.diagnose' | 'incidents.correct.CAPTURA' | 'incidents.correct.REGLA'
  | 'incidents.correct.CALCULO' | 'incidents.revalidate' | 'incidents.close' | 'incidents.sponsor'
  | 'audit.view' | 'system.manage';

export interface User { id: number; username: string; fullName: string; role: Role; roleLabel: string; permissions: Permission[] }

export type ListKey = 'debarment' | 'peps' | 'sanctions' | 'crime';
export type SyncStatus = 'idle' | 'running' | 'error';

export interface ListInfo {
  key: ListKey;
  name: string;
  description: string;
  icon: 'ban' | 'users' | 'globe' | 'alert';
  color: 'amber' | 'violet' | 'sky' | 'rose';
  active: boolean;
  recordCount: number;
  lastSyncAt: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  sources: { label: string; url: string }[];
}

export interface ListsResponse {
  summary: { totalRecords: number; lastSyncAt: string | null; isStale: boolean; activeLists: number };
  lists: ListInfo[];
}

export interface RecordRow {
  id: number;
  entityId: string;
  schema: string;
  name: string;
  aliases: string[];
  countries: string[];
  birthDate: string | null;
  dataset: string;
  sanctions: string | null;
}

export interface RecordsResponse {
  list: { key: ListKey; name: string };
  total: number;
  page: number;
  pageSize: number;
  records: RecordRow[];
}

// ─── Matriz LA/FT ─────────────────────────────────────────────────────────────

export const FACTOR_KEYS = ['monto', 'frecuencia', 'producto', 'canal', 'jurisdiccion', 'perfil', 'pep'] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];
export type Weights = Record<FactorKey, number>;
export type Scores = Record<FactorKey, number | null>;
export type LevelKey = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
export type AdjustmentType = 'CONTROL' | 'AGRAVANTE';

export interface FactorDef { key: FactorKey; label: string; short: string; question: string; scale: string[] }
export interface Methodology {
  factors: FactorDef[];
  levels: { key: LevelKey; label: string; min: number; max: number }[];
  missingScore: number;
  catalog: Record<AdjustmentType, { description: string; points: number }[]>;
}

export interface Adjustment { type: AdjustmentType; description: string; points: number }
export interface ScoreBreakdown {
  factors: { key: FactorKey; label: string; score: number; missing: boolean; weight: number; contribution: number }[];
  inherent: number;
  controls: number;
  aggravants: number;
  residual: number;
  level: LevelKey;
  missingCount: number;
}
export interface RiskEvent {
  id: number; code: string; description: string; clientName: string; product: string; channel: string;
  country: string; amount: string | null; currency: string; createdAt: string;
  adjustments: Adjustment[]; score: ScoreBreakdown;
}

export interface UserRef { username: string; fullName: string; role: Role }
export interface WeightVersion {
  id: number; version: string; weights: Weights; reason: string;
  status: 'PROPUESTA' | 'APROBADA' | 'RECHAZADA';
  createdBy: UserRef; createdAt: string;
  reviewedBy: UserRef | null; reviewedAt: string | null; reviewNote: string | null;
}

export interface NewRiskEvent {
  description: string; clientName: string; product: string; channel: string; country: string;
  amount: number | null; currency: 'USD' | 'GTQ' | 'EUR'; scores: Scores; adjustments: Adjustment[];
}

export interface SensitivityResult {
  version: string;
  orderChanged: boolean;
  rows: { code: string; description: string; base: number; scenario: number; baseRank: number; scenarioRank: number }[];
}

export interface ScreenMatch { listKey: ListKey; listName: string; name: string; schema: string; countries: string[] }

// ─── Seguimiento: gestión de datos incorrectos ────────────────────────────────

export type IncidentStatus = 'REGISTRADA' | 'DIAGNOSTICADA' | 'CORREGIDA' | 'REVALIDADA' | 'CERRADA'
export type IncidentCause = 'CAPTURA' | 'REGLA' | 'CALCULO'

export interface NextStep { key: 'diagnose' | 'correct' | 'revalidate' | 'sponsor' | 'close'; permission: Permission; label: string; roles: Role[] }

export interface Incident {
  id: number; code: string; factor: FactorKey | null; factorLabel: string | null; description: string;
  status: IncidentStatus; cause: IncidentCause | null;
  event: { code: string; description: string };
  detectedAt: string; detectedBy: UserRef;
  diagnosis: string | null; diagnosedBy: UserRef | null;
  correction: string | null; correctedBy: UserRef | null;
  scoreChange: { factor: FactorKey; from: number | null; to: number } | null;
  version: { id: number; version: string; status: WeightVersion['status'] } | null;
  residualBefore: number; rankBefore: number; residualAfter: number | null; rankAfter: number | null;
  orderImpact: boolean | null;
  revalidation: string | null; revalidatedBy: UserRef | null;
  sponsorNote: string | null; sponsorInformedBy: UserRef | null; sponsorInformedAt: string | null;
  approvalNote: string | null; approvedBy: UserRef | null; closedAt: string | null;
  daysOpen: number; overdue: boolean; next: NextStep | null;
}

export interface IncidentActivity { id: number; step: string; note: string | null; createdAt: string; user: UserRef | null }

export interface IncidentDetail extends Omit<Incident, 'event'> {
  event: { code: string; description: string; clientName: string; product: string; channel: string; country: string; scores: Scores };
  rankingBefore: string[];
  evaluation: { version: string; ranking: string[]; rank: number; residual: number; score: ScoreBreakdown };
  candidates: { id: number; version: string; status: WeightVersion['status']; reason: string }[];
  activities: IncidentActivity[];
}

export interface IncidentsResponse {
  incidents: Incident[];
  stats: { byStatus: Record<IncidentStatus, number>; overdue: number; withImpact: number };
  missing: { code: string; description: string; factors: { key: FactorKey; label: string }[]; openIncident: string | null }[];
  events: { code: string; description: string }[];
  slaDays: number;
}

// ─── Administración ───────────────────────────────────────────────────────────

export interface AdminUser {
  id: number; username: string; fullName: string; role: Role; roleLabel?: string; active: boolean;
  failedAttempts: number; lockedUntil: string | null; locked?: boolean; lastLoginAt: string | null; createdAt: string;
}

export interface Settings { sessionMinutes: number; maxFailedAttempts: number; lockMinutes: number; listStaleHours: number; incidentSlaDays: number }

export interface SettingsResponse {
  settings: Settings; updatedAt: string | null; updatedBy: { username: string; fullName: string } | null;
  matrix: { version: string | null; weights: Weights | null; levels: Methodology['levels']; missingScore: number };
}

export interface PermissionsTable {
  roles: { key: Role; label: string }[];
  permissions: { key: Permission; label: string; roles: Role[] }[];
}

export interface AuditEntry { id: number; createdAt: string; username: string | null; action: string; detail: string | null; ip: string | null }
export interface AuditResponse { total: number; page: number; pageSize: number; logs: AuditEntry[]; actions: string[] }

const post = <T,>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })
const send = <T,>(method: 'PUT' | 'PATCH', path: string, body: unknown) => request<T>(path, { method, body: JSON.stringify(body) })

export const api = {
  login: (username: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/auth/me'),

  lists: () => request<ListsResponse>('/lists'),
  syncAll: () => request<{ ok: true }>('/lists/sync', { method: 'POST' }),
  syncList: (key: ListKey) => request<{ ok: true }>(`/lists/${key}/sync`, { method: 'POST' }),
  records: (key: string, q: string, page: number) =>
    request<RecordsResponse>(`/lists/${encodeURIComponent(key)}/records?${new URLSearchParams({ q, page: String(page) })}`),

  methodology: () => request<Methodology>('/matrix/methodology'),
  riskEvents: (versionId?: number) =>
    request<{ version: WeightVersion; events: RiskEvent[] }>('/matrix/events' + (versionId ? `?versionId=${versionId}` : '')),
  createRiskEvent: (body: NewRiskEvent) =>
    request<{ id: number; code: string }>('/matrix/events', { method: 'POST', body: JSON.stringify(body) }),
  versions: () => request<{ currentId: number | null; versions: WeightVersion[] }>('/matrix/versions'),
  proposeVersion: (weights: Weights, reason: string) =>
    request<WeightVersion>('/matrix/versions', { method: 'POST', body: JSON.stringify({ weights, reason }) }),
  reviewVersion: (id: number, approve: boolean, note: string) =>
    request<WeightVersion>(`/matrix/versions/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ note }) }),
  sensitivity: (weights: Weights) =>
    request<SensitivityResult>('/matrix/sensitivity', { method: 'POST', body: JSON.stringify({ weights }) }),
  screen: (name: string) => request<{ matches: ScreenMatch[] }>(`/matrix/screen?${new URLSearchParams({ name })}`),

  incidents: () => request<IncidentsResponse>('/incidents'),
  incident: (code: string) => request<IncidentDetail>(`/incidents/${encodeURIComponent(code)}`),
  registerIncident: (body: { eventCode: string; factor: FactorKey | null; description: string }) =>
    post<{ code: string }>('/incidents', body),
  diagnoseIncident: (code: string, body: { cause: IncidentCause; factor?: FactorKey | null; note: string }) =>
    post<{ ok: true }>(`/incidents/${code}/diagnose`, body),
  correctIncident: (code: string, body: { note: string; newScore?: number; versionId?: number }) =>
    post<{ ok: true }>(`/incidents/${code}/correct`, body),
  revalidateIncident: (code: string, note: string) => post<{ ok: true; orderImpact: boolean }>(`/incidents/${code}/revalidate`, { note }),
  returnIncident: (code: string, note: string) => post<{ ok: true }>(`/incidents/${code}/return`, { note }),
  informSponsor: (code: string, note: string) => post<{ ok: true }>(`/incidents/${code}/sponsor`, { note }),
  closeIncident: (code: string, note: string) => post<{ ok: true }>(`/incidents/${code}/close`, { note }),

  permissions: () => request<PermissionsTable>('/admin/permissions'),
  users: () => request<{ users: AdminUser[] }>('/admin/users'),
  createUser: (body: { username: string; fullName: string; role: Role }) => post<{ user: AdminUser; password: string }>('/admin/users', body),
  updateUser: (id: number, body: { role?: Role; active?: boolean }) => send<{ user: AdminUser }>('PATCH', `/admin/users/${id}`, body),
  unlockUser: (id: number) => post<{ user: AdminUser }>(`/admin/users/${id}/unlock`),
  resetPassword: (id: number) => post<{ user: AdminUser; password: string }>(`/admin/users/${id}/reset-password`),
  settings: () => request<SettingsResponse>('/admin/settings'),
  saveSettings: (s: Settings) => send<{ settings: Settings }>('PUT', '/admin/settings', s),
  audit: (q: string, action: string, page: number) =>
    request<AuditResponse>(`/admin/audit?${new URLSearchParams({ q, action, page: String(page) })}`),
};
