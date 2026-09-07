import type {
  Incident,
  Plan,
  Risk,
  RiskRegister,
  RiskStatus,
  ExposureLevel,
} from "../types";
import { allFeatures, slugify } from "./plan";

export function riskScore(risk: Pick<Risk, "probability" | "impact">): number {
  return risk.probability * risk.impact;
}

export function exposureLevel(score: number): ExposureLevel {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

export const EXPOSURE_LABEL: Record<ExposureLevel, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
  critical: "Crítico",
};

export function isReviewOverdue(
  risk: Pick<Risk, "review_date" | "status">,
  today = todayISO(),
): boolean {
  return Boolean(
    risk.review_date &&
    risk.review_date < today &&
    riskStatusIsOpen(risk.status),
  );
}

export function isActiveRisk(risk: Pick<Risk, "status">): boolean {
  return riskStatusIsOpen(risk.status);
}

export type RiskStats = {
  open: number;
  critical: number;
  overdue: number;
  openIncidents: number;
  sprintIncidents: number;
};

export function riskStats(
  register: RiskRegister,
  sprint: number | null,
  today = todayISO(),
  sprintFeatureIds = new Set<string>(),
): RiskStats {
  return {
    open: register.risks.filter((risk) => isActiveRisk(risk)).length,
    critical: register.risks.filter(
      (risk) => isActiveRisk(risk) && riskScore(risk) >= 15,
    ).length,
    overdue: register.risks.filter((risk) => isReviewOverdue(risk, today))
      .length,
    openIncidents: register.incidents.filter(
      (incident) =>
        incident.status === "open" || incident.status === "investigating",
    ).length,
    sprintIncidents:
      sprint == null
        ? 0
        : register.incidents.filter(
            (incident) =>
              register.risks.find((risk) => risk.id === incident.risk_id)
                ?.related_sprint === sprint ||
              incident.related_feature_ids.some((id) =>
                sprintFeatureIds.has(id),
              ),
          ).length,
  };
}

export function todayISO(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function registerWith(
  register: RiskRegister,
  changes: Partial<RiskRegister>,
): RiskRegister {
  return {
    ...register,
    ...changes,
    meta: { ...register.meta, updated: todayISO() },
  };
}

export function uniqueRiskId(plan: Plan, title: string): string {
  const taken = new Set([
    ...plan.backlog.epics.map((epic) => epic.id),
    ...allFeatures(plan.backlog).map(({ feature }) => feature.id),
    ...plan.riskRegister.risks.map((risk) => risk.id),
    ...plan.riskRegister.incidents.map((incident) => incident.id),
  ]);
  const base = slugify(title) || "nuevo-riesgo";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1)
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

export function updateRisk(
  plan: Plan,
  riskId: string,
  patch: Partial<Risk>,
): Plan {
  return {
    ...plan,
    riskRegister: registerWith(plan.riskRegister, {
      risks: plan.riskRegister.risks.map((risk) =>
        risk.id === riskId ? { ...risk, ...patch } : risk,
      ),
    }),
  };
}

export function addRisk(plan: Plan, risk: Risk): Plan {
  return {
    ...plan,
    riskRegister: registerWith(plan.riskRegister, {
      risks: [...plan.riskRegister.risks, risk],
    }),
  };
}

export function removeRisk(plan: Plan, riskId: string): Plan {
  return {
    ...plan,
    riskRegister: registerWith(plan.riskRegister, {
      risks: plan.riskRegister.risks.filter((risk) => risk.id !== riskId),
      incidents: plan.riskRegister.incidents.map((incident) =>
        incident.risk_id === riskId ? { ...incident, risk_id: null } : incident,
      ),
    }),
  };
}

export function linkRiskFeature(
  plan: Plan,
  riskId: string,
  featureId: string,
  linked: boolean,
): Plan {
  const risk = plan.riskRegister.risks.find((item) => item.id === riskId);
  if (!risk) return plan;
  const related_feature_ids = linked
    ? [...new Set([...risk.related_feature_ids, featureId])]
    : risk.related_feature_ids.filter((id) => id !== featureId);
  return updateRisk(plan, riskId, { related_feature_ids });
}

export function emptyRisk(id: string): Risk {
  return {
    id,
    title: "Nuevo riesgo",
    description: "",
    category: "technical",
    status: "open",
    probability: 1,
    impact: 1,
    owner_id: null,
    identified_at: todayISO(),
    review_date: todayISO(),
    mitigation_plan: "",
    contingency_plan: "",
    related_feature_ids: [],
    related_sprint: null,
    notes: "",
  };
}

export function updateIncident(
  plan: Plan,
  incidentId: string,
  patch: Partial<Incident>,
): Plan {
  return {
    ...plan,
    riskRegister: registerWith(plan.riskRegister, {
      incidents: plan.riskRegister.incidents.map((incident) =>
        incident.id === incidentId ? { ...incident, ...patch } : incident,
      ),
    }),
  };
}

export function addIncident(plan: Plan, incident: Incident): Plan {
  return {
    ...plan,
    riskRegister: registerWith(plan.riskRegister, {
      incidents: [...plan.riskRegister.incidents, incident],
    }),
  };
}

export function removeIncident(plan: Plan, incidentId: string): Plan {
  return {
    ...plan,
    riskRegister: registerWith(plan.riskRegister, {
      incidents: plan.riskRegister.incidents.filter(
        (incident) => incident.id !== incidentId,
      ),
    }),
  };
}

export function emptyIncident(
  id: string,
  riskId: string | null = null,
): Incident {
  const date = todayISO();
  return {
    id,
    title: "Nuevo incidente",
    description: "",
    status: "open",
    severity: "medium",
    occurred_at: date,
    detected_at: date,
    resolved_at: null,
    owner_id: null,
    risk_id: riskId,
    related_feature_ids: [],
    impact_description: "",
    resolution: "",
    lessons_learned: "",
  };
}

export function riskStatusIsOpen(status: RiskStatus): boolean {
  return status === "open" || status === "monitoring";
}
