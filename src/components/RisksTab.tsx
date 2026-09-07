import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  Incident,
  IncidentSeverity,
  Plan,
  Risk,
  RiskCategory,
  RiskStatus,
} from "../types";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABEL,
  RISK_CATEGORIES,
  RISK_CATEGORY_LABEL,
  RISK_STATUSES,
  RISK_STATUS_LABEL,
} from "../types";
import {
  addIncident,
  addRisk,
  emptyIncident,
  emptyRisk,
  exposureLevel,
  EXPOSURE_LABEL,
  isReviewOverdue,
  linkRiskFeature,
  removeIncident,
  removeRisk,
  riskScore,
  riskStats,
  todayISO,
  uniqueRiskId,
  updateIncident,
  updateRisk,
} from "../lib/risks";
import { allFeatures } from "../lib/plan";
import { planningWeek } from "../lib/week";
import { Button, Field, SectionTitle, cn } from "./ui";

type View = "matrix" | "registry" | "incidents";

const levelStyle = {
  low: "bg-[#e8f5ed] text-[#167344]",
  medium: "bg-[#fff3d8] text-[#976000]",
  high: "bg-[#ffe7d7] text-[#ad4319]",
  critical: "bg-[#ffe3e1] text-[#b30500]",
} as const;

export function RisksTab({
  plan,
  update,
}: {
  plan: Plan;
  update: (fn: (plan: Plan) => Plan) => void;
}) {
  const [view, setView] = useState<View>("matrix");
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sprintFilter, setSprintFilter] = useState("all");

  const week = useMemo(
    () => planningWeek(plan.team.sprints),
    [plan.team.sprints],
  );
  const sprintFeatureIds = useMemo(
    () =>
      new Set(
        allFeatures(plan.backlog)
          .filter(({ epic }) => epic.sprint === week.sprint?.number)
          .map(({ feature }) => feature.id),
      ),
    [plan.backlog, week.sprint?.number],
  );
  const stats = riskStats(
    plan.riskRegister,
    week.sprint?.number ?? null,
    todayISO(),
    sprintFeatureIds,
  );
  const activeRisk =
    plan.riskRegister.risks.find((risk) => risk.id === selectedRiskId) ?? null;
  const activeIncident =
    plan.riskRegister.incidents.find(
      (incident) => incident.id === selectedIncidentId,
    ) ?? null;

  const filteredRisks = useMemo(() => {
    return plan.riskRegister.risks
      .filter((risk) => statusFilter === "all" || risk.status === statusFilter)
      .filter(
        (risk) => categoryFilter === "all" || risk.category === categoryFilter,
      )
      .filter((risk) => ownerFilter === "all" || risk.owner_id === ownerFilter)
      .filter(
        (risk) =>
          sprintFilter === "all" ||
          String(risk.related_sprint ?? "") === sprintFilter,
      )
      .sort(
        (a, b) =>
          riskScore(b) - riskScore(a) ||
          (a.review_date ?? "9999").localeCompare(b.review_date ?? "9999"),
      );
  }, [
    plan.riskRegister.risks,
    statusFilter,
    categoryFilter,
    ownerFilter,
    sprintFilter,
  ]);

  function createRisk() {
    const risk = emptyRisk(uniqueRiskId(plan, "nuevo-riesgo"));
    update((current) => addRisk(current, risk));
    setSelectedRiskId(risk.id);
    setSelectedIncidentId(null);
    setView("registry");
  }

  function createIncident(riskId: string | null = null) {
    const incident = emptyIncident(
      uniqueRiskId(plan, "nuevo-incidente"),
      riskId,
    );
    update((current) => addIncident(current, incident));
    setSelectedIncidentId(incident.id);
    setSelectedRiskId(null);
    setView("incidents");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-tight">
            Riesgos e incidentes
          </h2>
        </div>
        <Button
          variant="primary"
          onClick={createRisk}
          icon={<Plus className="size-4" />}
        >
          Nuevo riesgo
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metric label="Riesgos abiertos" value={stats.open} tone="plain" />
        <Metric label="Críticos" value={stats.critical} tone="critical" />
        <Metric
          label="Revisiones vencidas"
          value={stats.overdue}
          tone="warning"
        />
        <Metric
          label="Incidentes abiertos"
          value={stats.openIncidents}
          tone="critical"
        />
        <Metric
          label="Incidentes del sprint"
          value={stats.sprintIncidents}
          tone="plain"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div
          className="flex gap-1 rounded-full bg-muted p-1"
          role="tablist"
          aria-label="Sección de riesgos"
        >
          {(
            [
              ["matrix", "Matriz"],
              ["registry", "Registro"],
              ["incidents", "Incidentes"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                view === id
                  ? "bg-foreground text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Actualizado {String(plan.riskRegister.meta.updated ?? todayISO())}
        </span>
      </div>

      {view !== "incidents" ? (
        <RiskFilters
          plan={plan}
          status={statusFilter}
          category={categoryFilter}
          owner={ownerFilter}
          sprint={sprintFilter}
          onStatus={setStatusFilter}
          onCategory={setCategoryFilter}
          onOwner={setOwnerFilter}
          onSprint={setSprintFilter}
        />
      ) : null}

      {view === "matrix" ? (
        <div
          className={cn(
            "gap-6",
            activeRisk && "xl:grid xl:grid-cols-[minmax(0,1fr)_390px]",
          )}
        >
          <RiskMatrix
            risks={filteredRisks}
            onSelect={(id) =>
              setSelectedRiskId(id === selectedRiskId ? null : id)
            }
          />
          {activeRisk ? (
            <RiskEditor
              plan={plan}
              risk={activeRisk}
              update={update}
              onClose={() => setSelectedRiskId(null)}
              onCreateIncident={() => createIncident(activeRisk.id)}
              onSelectIncident={(id) => {
                setSelectedRiskId(null);
                setSelectedIncidentId(id);
                setView("incidents");
              }}
            />
          ) : null}
        </div>
      ) : null}

      {view === "registry" ? (
        <div
          className={cn(
            "gap-6",
            activeRisk && "xl:grid xl:grid-cols-[minmax(0,1fr)_390px]",
          )}
        >
          <RiskList
            risks={filteredRisks}
            selectedId={selectedRiskId}
            onSelect={setSelectedRiskId}
          />
          {activeRisk ? (
            <RiskEditor
              plan={plan}
              risk={activeRisk}
              update={update}
              onClose={() => setSelectedRiskId(null)}
              onCreateIncident={() => createIncident(activeRisk.id)}
              onSelectIncident={(id) => {
                setSelectedRiskId(null);
                setSelectedIncidentId(id);
                setView("incidents");
              }}
            />
          ) : null}
        </div>
      ) : null}

      {view === "incidents" ? (
        <div
          className={cn(
            "gap-6",
            activeIncident && "xl:grid xl:grid-cols-[minmax(0,1fr)_390px]",
          )}
        >
          <IncidentList
            plan={plan}
            incidents={plan.riskRegister.incidents}
            selectedId={selectedIncidentId}
            onSelect={setSelectedIncidentId}
            onCreate={() => createIncident()}
          />
          {activeIncident ? (
            <IncidentEditor
              plan={plan}
              incident={activeIncident}
              update={update}
              onClose={() => setSelectedIncidentId(null)}
              onSelectRisk={(id) => {
                setSelectedIncidentId(null);
                setSelectedRiskId(id);
                setView("registry");
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "plain" | "critical" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card px-4 py-3",
        tone === "critical" && value > 0 && "border-brand/25 bg-brand-50/40",
        tone === "warning" &&
          value > 0 &&
          "border-warning/30 bg-warning-soft/60",
      )}
    >
      <p
        className={cn(
          "font-display text-2xl font-bold",
          tone === "critical" && value > 0 && "text-brand-700",
          tone === "warning" && value > 0 && "text-[#976000]",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function RiskFilters({
  plan,
  status,
  category,
  owner,
  sprint,
  onStatus,
  onCategory,
  onOwner,
  onSprint,
}: {
  plan: Plan;
  status: string;
  category: string;
  owner: string;
  sprint: string;
  onStatus: (value: string) => void;
  onCategory: (value: string) => void;
  onOwner: (value: string) => void;
  onSprint: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="field w-auto min-w-36 py-2 text-xs"
        value={status}
        onChange={(event) => onStatus(event.target.value)}
        aria-label="Filtrar por estado"
      >
        <option value="all">Todos los estados</option>
        {RISK_STATUSES.map((item) => (
          <option key={item} value={item}>
            {RISK_STATUS_LABEL[item]}
          </option>
        ))}
      </select>
      <select
        className="field w-auto min-w-32 py-2 text-xs"
        value={category}
        onChange={(event) => onCategory(event.target.value)}
        aria-label="Filtrar por categoría"
      >
        <option value="all">Todas las categorías</option>
        {RISK_CATEGORIES.map((item) => (
          <option key={item} value={item}>
            {RISK_CATEGORY_LABEL[item]}
          </option>
        ))}
      </select>
      <select
        className="field w-auto min-w-32 py-2 text-xs"
        value={owner}
        onChange={(event) => onOwner(event.target.value)}
        aria-label="Filtrar por responsable"
      >
        <option value="all">Todos los responsables</option>
        {plan.team.people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      <select
        className="field w-auto min-w-28 py-2 text-xs"
        value={sprint}
        onChange={(event) => onSprint(event.target.value)}
        aria-label="Filtrar por sprint"
      >
        <option value="all">Todos los sprints</option>
        {plan.team.sprints.map((item) => (
          <option key={item.number} value={item.number}>
            Sprint {item.number}
          </option>
        ))}
      </select>
    </div>
  );
}

function RiskMatrix({
  risks,
  onSelect,
}: {
  risks: Risk[];
  onSelect: (id: string) => void;
}) {
  const buckets = new Map<string, Risk[]>();
  for (const risk of risks) {
    const key = `${risk.probability}-${risk.impact}`;
    buckets.set(key, [...(buckets.get(key) ?? []), risk]);
  }
  return (
    <section className="card overflow-hidden">
      <div className="overflow-x-auto p-5">
        <div className="mb-3 flex justify-end gap-4 text-[10px] text-muted-foreground">
          <Legend color="bg-[#d8f0df]" text="Bajo" />
          <Legend color="bg-[#ffe7ad]" text="Medio" />
          <Legend color="bg-[#ffc5a8]" text="Alto" />
          <Legend color="bg-[#ffaaa5]" text="Crítico" />
        </div>
        <div className="grid w-full min-w-[590px] grid-cols-[48px_repeat(5,minmax(88px,1fr))] grid-rows-[28px_repeat(5,80px)] gap-1.5">
          <span />
          {[1, 2, 3, 4, 5].map((impact) => (
            <span
              key={impact}
              className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              Impacto {impact}
            </span>
          ))}
          {[5, 4, 3, 2, 1].map((probability) => (
            <div key={`row-${probability}`} className="contents">
              <div className="flex items-center justify-end pr-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="[writing-mode:vertical-rl]">
                  Prob. {probability}
                </span>
              </div>
              {[1, 2, 3, 4, 5].map((impact) => {
                const items = buckets.get(`${probability}-${impact}`) ?? [];
                const level = exposureLevel(probability * impact);
                return (
                  <div
                    key={`${probability}-${impact}`}
                    className={cn(
                      "relative rounded-xl border border-white/70 p-1.5",
                      level === "low" && "bg-[#e8f5ed]",
                      level === "medium" && "bg-[#fff3d8]",
                      level === "high" && "bg-[#ffe7d7]",
                      level === "critical" && "bg-[#ffe3e1]",
                    )}
                    aria-label={`Probabilidad ${probability}, impacto ${impact}`}
                  >
                    <div className="absolute right-2 top-1 text-[10px] font-bold opacity-40">
                      {probability * impact}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-4">
                      {items.map((risk) => (
                        <button
                          key={risk.id}
                          type="button"
                          onClick={() => onSelect(risk.id)}
                          title={`${risk.title} · ${riskScore(risk)} puntos`}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-full border-2 border-white font-display text-[11px] font-bold shadow-sm transition hover:scale-110 hover:shadow-md",
                            levelStyle[exposureLevel(riskScore(risk))],
                          )}
                        >
                          {riskScore(risk)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {risks.length === 0 ? (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            No hay riesgos que coincidan con los filtros.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={cn("size-2 rounded-full", color)} />
      {text}
    </span>
  );
}

function RiskList({
  risks,
  selectedId,
  onSelect,
}: {
  risks: Risk[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <SectionTitle
        action={
          <span className="text-xs text-muted-foreground">
            {risks.length} registrados
          </span>
        }
      >
        Registro priorizado
      </SectionTitle>
      {risks.length === 0 ? (
        <EmptySelection text="Todavía no hay riesgos registrados." />
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {risks.map((risk) => (
            <button
              key={risk.id}
              type="button"
              onClick={() => onSelect(risk.id)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/60",
                selectedId === risk.id && "bg-brand-50/60",
              )}
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl font-display font-bold",
                  levelStyle[exposureLevel(riskScore(risk))],
                )}
              >
                <strong className="text-base leading-none">
                  {riskScore(risk)}
                </strong>
                <small className="mt-0.5 text-[9px] uppercase">
                  {EXPOSURE_LABEL[exposureLevel(riskScore(risk))]}
                </small>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {risk.title || "Sin título"}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{RISK_CATEGORY_LABEL[risk.category]}</span>
                  <span>·</span>
                  <span>{risk.owner_id ?? "Sin responsable"}</span>
                  {isReviewOverdue(risk) ? (
                    <span className="font-semibold text-[#976000]">
                      · Revisión vencida
                    </span>
                  ) : null}
                </span>
              </span>
              <RiskStatusBadge status={risk.status} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function RiskEditor({
  plan,
  risk,
  update,
  onClose,
  onCreateIncident,
  onSelectIncident,
}: {
  plan: Plan;
  risk: Risk;
  update: (fn: (plan: Plan) => Plan) => void;
  onClose: () => void;
  onCreateIncident: () => void;
  onSelectIncident: (id: string) => void;
}) {
  const score = riskScore(risk);
  const level = exposureLevel(score);
  const incomplete =
    score >= 10 &&
    (!risk.owner_id || !risk.mitigation_plan.trim() || !risk.review_date);
  function patch(changes: Partial<Risk>) {
    update((current) => updateRisk(current, risk.id, changes));
  }
  function remove() {
    if (confirm(`¿Eliminar el riesgo "${risk.title}"?`)) {
      update((current) => removeRisk(current, risk.id));
      onClose();
    }
  }
  return (
    <aside className="card flex max-h-[calc(100vh-10rem)] flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-700">
            Detalle del riesgo
          </p>
          <code className="text-[11px] text-muted-foreground">{risk.id}</code>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="danger"
            onClick={remove}
            icon={<Trash2 className="size-3.5" />}
          >
            Eliminar
          </Button>
          <Button variant="ghost" onClick={onClose} title="Cerrar">
            <X className="size-4" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div
          className={cn(
            "flex items-center justify-between rounded-xl px-3 py-3",
            levelStyle[level],
          )}
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-wider">
              Exposición {EXPOSURE_LABEL[level]}
            </span>
            <strong className="font-display text-3xl">
              {score}
              <small className="ml-1 text-xs font-semibold">/ 25</small>
            </strong>
          </span>
          <span className="text-right text-[11px]">
            Prob. {risk.probability}
            <br />
            Impacto {risk.impact}
          </span>
        </div>
        {incomplete ? (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[11px] text-[#976000]">
            <AlertTriangle className="mr-1 inline size-3.5" />
            Un riesgo alto requiere responsable, mitigación y fecha de revisión.
          </p>
        ) : null}
        <Field label="Título">
          <input
            className="field"
            value={risk.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className="field min-h-24 resize-y"
            value={risk.description}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="Qué podría ocurrir y por qué importa..."
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <select
              className="field"
              value={risk.category}
              onChange={(event) =>
                patch({ category: event.target.value as RiskCategory })
              }
            >
              {RISK_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {RISK_CATEGORY_LABEL[item]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="field"
              value={risk.status}
              onChange={(event) =>
                patch({ status: event.target.value as RiskStatus })
              }
            >
              {RISK_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {RISK_STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ScaleField
            label="Probabilidad"
            value={risk.probability}
            onChange={(value) => patch({ probability: value })}
          />
          <ScaleField
            label="Impacto"
            value={risk.impact}
            onChange={(value) => patch({ impact: value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable">
            <select
              className="field"
              value={risk.owner_id ?? ""}
              onChange={(event) =>
                patch({ owner_id: event.target.value || null })
              }
            >
              <option value="">Sin asignar</option>
              {plan.team.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sprint">
            <select
              className="field"
              value={risk.related_sprint ?? ""}
              onChange={(event) =>
                patch({
                  related_sprint: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            >
              <option value="">Sin sprint</option>
              {plan.team.sprints.map((sprint) => (
                <option key={sprint.number} value={sprint.number}>
                  Sprint {sprint.number}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Identificado">
            <input
              className="field"
              type="date"
              value={risk.identified_at}
              onChange={(event) => patch({ identified_at: event.target.value })}
            />
          </Field>
          <Field label="Próxima revisión">
            <input
              className={cn("field", isReviewOverdue(risk) && "border-warning")}
              type="date"
              value={risk.review_date ?? ""}
              onChange={(event) =>
                patch({ review_date: event.target.value || null })
              }
            />
          </Field>
        </div>
        <Field label="Plan de mitigación">
          <textarea
            className="field min-h-20 resize-y"
            value={risk.mitigation_plan}
            onChange={(event) => patch({ mitigation_plan: event.target.value })}
            placeholder="Qué haremos para reducir probabilidad o impacto..."
          />
        </Field>
        <Field label="Plan de contingencia">
          <textarea
            className="field min-h-20 resize-y"
            value={risk.contingency_plan}
            onChange={(event) =>
              patch({ contingency_plan: event.target.value })
            }
            placeholder="Qué haremos si el riesgo ocurre..."
          />
        </Field>
        <FeaturePicker
          plan={plan}
          values={risk.related_feature_ids}
          onChange={(id, linked) =>
            update((current) => linkRiskFeature(current, risk.id, id, linked))
          }
        />
        <Field label="Notas">
          <textarea
            className="field min-h-16 resize-y"
            value={risk.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>
        {plan.riskRegister.incidents.filter(
          (incident) => incident.risk_id === risk.id,
        ).length > 0 ? (
          <div>
            <span className="label">Incidentes vinculados</span>
            <div className="space-y-1">
              {plan.riskRegister.incidents
                .filter((incident) => incident.risk_id === risk.id)
                .map((incident) => (
                  <button
                    key={incident.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg bg-muted px-2.5 py-2 text-left text-xs hover:bg-muted/70"
                    onClick={() => onSelectIncident(incident.id)}
                  >
                    <span className="truncate">{incident.title}</span>
                    <ChevronRight className="size-3.5 shrink-0" />
                  </button>
                ))}
            </div>
          </div>
        ) : null}
        {risk.status === "materialized" ? (
          <Button
            variant="primary"
            onClick={onCreateIncident}
            icon={<Plus className="size-4" />}
          >
            Registrar incidente vinculado
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => patch({ status: "materialized" })}
            icon={<AlertTriangle className="size-4" />}
          >
            Marcar como materializado
          </Button>
        )}
      </div>
    </aside>
  );
}

function ScaleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="field"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {[1, 2, 3, 4, 5].map((item) => (
          <option key={item} value={item}>
            {item} · {item === 1 ? "Muy baja" : item === 5 ? "Muy alta" : ""}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FeaturePicker({
  plan,
  values,
  onChange,
}: {
  plan: Plan;
  values: string[];
  onChange: (id: string, linked: boolean) => void;
}) {
  const features = allFeatures(plan.backlog);
  return (
    <div>
      <span className="label">Funcionalidades afectadas</span>
      <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
        {features.map(({ feature, epic }) => (
          <label
            key={feature.id}
            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-[#e10600]"
              checked={values.includes(feature.id)}
              onChange={(event) => onChange(feature.id, event.target.checked)}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {feature.title}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                S{epic.sprint} · {epic.title}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function IncidentList({
  plan,
  incidents,
  selectedId,
  onSelect,
  onCreate,
}: {
  plan: Plan;
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const sorted = [...incidents].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
  return (
    <section>
      <SectionTitle
        action={
          <Button onClick={onCreate} icon={<Plus className="size-3.5" />}>
            Nuevo incidente
          </Button>
        }
      >
        Historial de incidentes
      </SectionTitle>
      {sorted.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="mt-2 text-sm font-semibold">
            No hay incidentes registrados
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Los incidentes independientes o materializados aparecen acá.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-border overflow-hidden">
          {sorted.map((incident) => {
            const risk = plan.riskRegister.risks.find(
              (item) => item.id === incident.risk_id,
            );
            return (
              <button
                key={incident.id}
                type="button"
                onClick={() => onSelect(incident.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/60",
                  selectedId === incident.id && "bg-brand-50/60",
                )}
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    incident.severity === "critical" ||
                      incident.severity === "high"
                      ? "bg-brand"
                      : incident.severity === "medium"
                        ? "bg-warning"
                        : "bg-success",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {incident.title || "Sin título"}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    {incident.occurred_at} ·{" "}
                    {risk ? `Riesgo: ${risk.title}` : "Sin riesgo vinculado"}
                  </span>
                </span>
                <IncidentSeverityBadge severity={incident.severity} />
                <RiskStatusBadge
                  status={
                    incident.status === "investigating"
                      ? "monitoring"
                      : incident.status === "open"
                        ? "open"
                        : "closed"
                  }
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function IncidentEditor({
  plan,
  incident,
  update,
  onClose,
  onSelectRisk,
}: {
  plan: Plan;
  incident: Incident;
  update: (fn: (plan: Plan) => Plan) => void;
  onClose: () => void;
  onSelectRisk: (id: string) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  function patch(changes: Partial<Incident>) {
    update((current) => updateIncident(current, incident.id, changes));
    setMessage(null);
  }
  function setStatus(status: Incident["status"]) {
    if (
      (status === "resolved" || status === "closed") &&
      (!incident.resolution.trim() || !incident.lessons_learned.trim())
    ) {
      setMessage("Completá resolución y lecciones aprendidas antes de cerrar.");
      return;
    }
    patch({ status, resolved_at: status === "resolved" ? todayISO() : null });
  }
  function remove() {
    if (confirm(`¿Eliminar el incidente "${incident.title}"?`)) {
      update((current) => removeIncident(current, incident.id));
      onClose();
    }
  }
  const linkedRisk = plan.riskRegister.risks.find(
    (risk) => risk.id === incident.risk_id,
  );
  return (
    <aside className="card flex max-h-[calc(100vh-10rem)] flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-700">
            Detalle del incidente
          </p>
          <code className="text-[11px] text-muted-foreground">
            {incident.id}
          </code>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="danger"
            onClick={remove}
            icon={<Trash2 className="size-3.5" />}
          >
            Eliminar
          </Button>
          <Button variant="ghost" onClick={onClose} title="Cerrar">
            <X className="size-4" />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-2">
          <IncidentSeverityBadge severity={incident.severity} />
          <RiskStatusBadge
            status={
              incident.status === "investigating"
                ? "monitoring"
                : incident.status === "open"
                  ? "open"
                  : "closed"
            }
          />
        </div>
        {message ? (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-[11px] text-[#976000]">
            <AlertTriangle className="mr-1 inline size-3.5" />
            {message}
          </p>
        ) : null}
        <Field label="Título">
          <input
            className="field"
            value={incident.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className="field min-h-20 resize-y"
            value={incident.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Severidad">
            <select
              className="field"
              value={incident.severity}
              onChange={(event) =>
                patch({ severity: event.target.value as IncidentSeverity })
              }
            >
              {INCIDENT_SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {INCIDENT_SEVERITY_LABEL[item]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="field"
              value={incident.status}
              onChange={(event) =>
                setStatus(event.target.value as Incident["status"])
              }
            >
              {INCIDENT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {INCIDENT_STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ocurrió">
            <input
              className="field"
              type="date"
              value={incident.occurred_at}
              onChange={(event) => patch({ occurred_at: event.target.value })}
            />
          </Field>
          <Field label="Detectado">
            <input
              className="field"
              type="date"
              value={incident.detected_at}
              onChange={(event) => patch({ detected_at: event.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable">
            <select
              className="field"
              value={incident.owner_id ?? ""}
              onChange={(event) =>
                patch({ owner_id: event.target.value || null })
              }
            >
              <option value="">Sin asignar</option>
              {plan.team.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Riesgo origen">
            <select
              className="field"
              value={incident.risk_id ?? ""}
              onChange={(event) =>
                patch({ risk_id: event.target.value || null })
              }
            >
              <option value="">Sin riesgo</option>
              {plan.riskRegister.risks.map((risk) => (
                <option key={risk.id} value={risk.id}>
                  {risk.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {linkedRisk ? (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            onClick={() => onSelectRisk(linkedRisk.id)}
          >
            Ver riesgo origen <ChevronRight className="size-3.5" />
          </button>
        ) : null}
        <FeaturePicker
          plan={plan}
          values={incident.related_feature_ids}
          onChange={(id, linked) =>
            patch({
              related_feature_ids: linked
                ? [...new Set([...incident.related_feature_ids, id])]
                : incident.related_feature_ids.filter((value) => value !== id),
            })
          }
        />
        <Field label="Descripción del impacto">
          <textarea
            className="field min-h-20 resize-y"
            value={incident.impact_description}
            onChange={(event) =>
              patch({ impact_description: event.target.value })
            }
          />
        </Field>
        <Field
          label="Resolución"
          hint={
            incident.status === "resolved"
              ? "Obligatoria para cerrar el incidente."
              : undefined
          }
        >
          <textarea
            className="field min-h-20 resize-y"
            value={incident.resolution}
            onChange={(event) => patch({ resolution: event.target.value })}
          />
        </Field>
        <Field
          label="Lecciones aprendidas"
          hint={
            incident.status === "resolved"
              ? "Obligatorias para cerrar el incidente."
              : undefined
          }
        >
          <textarea
            className="field min-h-20 resize-y"
            value={incident.lessons_learned}
            onChange={(event) => patch({ lessons_learned: event.target.value })}
          />
        </Field>
      </div>
    </aside>
  );
}

function RiskStatusBadge({ status }: { status: RiskStatus | "closed" }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
      {RISK_STATUS_LABEL[status]}
    </span>
  );
}
function IncidentSeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold",
        levelStyle[
          severity === "critical"
            ? "critical"
            : severity === "high"
              ? "high"
              : severity === "medium"
                ? "medium"
                : "low"
        ],
      )}
    >
      {INCIDENT_SEVERITY_LABEL[severity]}
    </span>
  );
}
function EmptySelection({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>
  );
}
