/** Mismo flujo que Linear: `backlog` = el ticket ya existe pero nadie lo empezó. */
export type Status = "todo" | "backlog" | "in_progress" | "done" | "blocked";
export type Moscow = "must" | "should" | "could" | "wont";

export const STATUSES: Status[] = [
  "todo",
  "backlog",
  "in_progress",
  "done",
  "blocked",
];
export const MOSCOW: Moscow[] = ["must", "should", "could", "wont"];
export const ESTIMATES = [1, 2, 3, 4, 5] as const;

export const STATUS_LABEL: Record<Status, string> = {
  todo: "Sin ticket",
  backlog: "En Linear",
  in_progress: "En curso",
  done: "Terminado",
  blocked: "Bloqueado",
};

export const MOSCOW_LABEL: Record<Moscow, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

/** Una funcionalidad: la unidad que despues se convierte en uno o mas tickets. */
export type Feature = {
  id: string;
  title: string;
  description: string;
  status: Status;
  /** Story points sugeridos. 1 SP = 1 hora. */
  estimate: number | null;
  /** Fecha estimada de inicio, 'YYYY-MM-DD'. Null = todavia sin ubicar en el cronograma. */
  starts: string | null;
  /** Fecha estimada de fin: la fecha limite del ticket. */
  ends: string | null;
  /** Archivos del prototipo que definen el comportamiento esperado. */
  prototype: string[];
  /** Ids de otras funcionalidades que tienen que estar antes. */
  depends_on: string[];
  /** Identificadores de Linear ya creados para esta funcionalidad. */
  ticket_refs: string[];
  moscow?: Moscow;
};

/** Una epica: agrupa funcionalidades y se mapea a un project de Linear. */
export type Epic = {
  id: string;
  title: string;
  description: string;
  sprint: number;
  linear_project: string | null;
  moscow: Moscow;
  status: Status;
  /** Epica de margen: su trabajo se ancla a la ultima semana del sprint. */
  fixes?: boolean;
  features: Feature[];
};

export type Backlog = {
  meta: Record<string, unknown>;
  out_of_scope: string[];
  epics: Epic[];
};

export type Person = {
  id: string;
  name: string;
  role: string;
  linear_user_id: string | null;
  takes_tickets: boolean;
  weekly_points: number;
};

export type Sprint = {
  number: number;
  name: string;
  cycle_id: string | null;
  starts: string;
  ends: string;
  weeks: number;
  theme: string;
  linear_projects: string[];
  notes?: string;
};

export type Capacity = {
  developers: number;
  points_per_developer_per_week: number;
  total_points_per_week: number;
  /** Porcion de la capacidad semanal que se reserva para fixes e imprevistos. */
  buffer_ratio: number;
  scale: string;
  allowed_estimates: number[];
  notes?: string;
};

export type Team = {
  meta: Record<string, unknown>;
  project: Record<string, unknown>;
  linear: Record<string, unknown>;
  week: { starts_on: string; length_days: number; notes?: string };
  capacity: Capacity;
  sprints: Sprint[];
  people: Person[];
  definition_of_done: string[];
};

export type RiskCategory =
  "technical" | "schedule" | "scope" | "people" | "external";
export type RiskStatus =
  "open" | "monitoring" | "mitigated" | "closed" | "materialized";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type ExposureLevel = "low" | "medium" | "high" | "critical";

export const RISK_CATEGORIES: RiskCategory[] = [
  "technical",
  "schedule",
  "scope",
  "people",
  "external",
];
export const RISK_STATUSES: RiskStatus[] = [
  "open",
  "monitoring",
  "mitigated",
  "closed",
  "materialized",
];
export const INCIDENT_STATUSES: IncidentStatus[] = [
  "open",
  "investigating",
  "resolved",
  "closed",
];
export const INCIDENT_SEVERITIES: IncidentSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const RISK_CATEGORY_LABEL: Record<RiskCategory, string> = {
  technical: "Técnico",
  schedule: "Cronograma",
  scope: "Alcance",
  people: "Personas",
  external: "Externo",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  open: "Abierto",
  monitoring: "En seguimiento",
  mitigated: "Mitigado",
  closed: "Cerrado",
  materialized: "Materializado",
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Abierto",
  investigating: "Investigando",
  resolved: "Resuelto",
  closed: "Cerrado",
};

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

export type Risk = {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  status: RiskStatus;
  probability: number;
  impact: number;
  owner_id: string | null;
  identified_at: string;
  review_date: string | null;
  mitigation_plan: string;
  contingency_plan: string;
  related_feature_ids: string[];
  related_sprint: number | null;
  notes: string;
};

export type Incident = {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  occurred_at: string;
  detected_at: string;
  resolved_at: string | null;
  owner_id: string | null;
  risk_id: string | null;
  related_feature_ids: string[];
  impact_description: string;
  resolution: string;
  lessons_learned: string;
};

export type RiskRegister = {
  meta: Record<string, unknown>;
  risks: Risk[];
  incidents: Incident[];
};

export type Plan = { backlog: Backlog; team: Team; riskRegister: RiskRegister };
