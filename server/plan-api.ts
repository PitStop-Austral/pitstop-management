import { existsSync } from "node:fs";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parse, stringify } from "yaml";
import type { Plan } from "../src/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILES = {
  backlog: path.join(root, "project-plan", "features.yaml"),
  team: path.join(root, "project-plan", "team.yaml"),
  risks: path.join(root, "project-plan", "risks.yaml"),
};

/** El prototipo vive fuera de este repo; si no esta, el autocompletado queda vacio. */
const PROTOTYPE_ROOT = path.resolve(root, "..", "PitStop Prototype");

const HEADER = [
  "# Generado por PitStop Management (npm run dev).",
  "# Se puede editar a mano, pero la app reescribe el archivo entero al guardar,",
  "# asi que los comentarios que agregues aca se van a perder.",
  "",
].join("\n");

const STRINGIFY_OPTIONS = { lineWidth: 88, minContentWidth: 24 } as const;

async function readYaml<T>(file: string): Promise<T> {
  return parse(await readFile(file, "utf8")) as T;
}

/** Escribe primero en un temporal y despues renombra, para no dejar el yaml a medias. */
async function writeYaml(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, HEADER + stringify(data, STRINGIFY_OPTIONS), "utf8");
  await rename(tmp, file);
}

export async function readPlan(): Promise<Plan> {
  const [backlog, team, riskRegister] = await Promise.all([
    readYaml<Plan["backlog"]>(FILES.backlog),
    readYaml<Plan["team"]>(FILES.team),
    readYaml<Plan["riskRegister"]>(FILES.risks),
  ]);
  return { backlog, team, riskRegister };
}

/**
 * Rechaza cualquier cosa que no parezca un plan valido. La app es la unica que
 * escribe estos archivos, asi que un bug en el front no puede vaciarlos.
 */
function validate(plan: unknown): string | null {
  const p = plan as Partial<Plan> | null;
  if (!p || typeof p !== "object") return "El cuerpo no es un objeto";
  if (!p.backlog || !Array.isArray(p.backlog.epics))
    return "Falta backlog.epics";
  if (!p.team || !Array.isArray(p.team.people)) return "Falta team.people";
  if (
    !p.riskRegister ||
    !Array.isArray(p.riskRegister.risks) ||
    !Array.isArray(p.riskRegister.incidents)
  ) {
    return "Falta riskRegister.risks o riskRegister.incidents";
  }
  if (p.backlog.epics.length === 0)
    return "El backlog no puede quedar sin epicas";
  if (p.team.people.length === 0) return "El equipo no puede quedar vacio";

  const ids = new Set<string>();
  for (const epic of p.backlog.epics) {
    if (!epic.id) return "Hay una epica sin id";
    if (ids.has(epic.id)) return `Id de epica repetido: ${epic.id}`;
    ids.add(epic.id);
    if (!Array.isArray(epic.features))
      return `La epica ${epic.id} no tiene features`;
    for (const feature of epic.features) {
      if (!feature.id) return `Hay una funcionalidad sin id en ${epic.id}`;
      if (ids.has(feature.id))
        return `Id de funcionalidad repetido: ${feature.id}`;
      ids.add(feature.id);
    }
  }
  const people = new Set(p.team.people.map((person) => person.id));
  const features = new Set(
    p.backlog.epics.flatMap((epic) =>
      epic.features.map((feature) => feature.id),
    ),
  );
  const sprints = new Set(
    (p.team.sprints ?? []).map((sprint) => sprint.number),
  );
  const riskIds = new Set<string>();
  const validRiskCategories = new Set([
    "technical",
    "schedule",
    "scope",
    "people",
    "external",
  ]);
  const validRiskStatuses = new Set([
    "open",
    "monitoring",
    "mitigated",
    "closed",
    "materialized",
  ]);
  const validIncidentStatuses = new Set([
    "open",
    "investigating",
    "resolved",
    "closed",
  ]);
  const validSeverities = new Set(["low", "medium", "high", "critical"]);
  const date = /^\d{4}-\d{2}-\d{2}$/;

  for (const risk of p.riskRegister.risks) {
    if (!risk.id || ids.has(risk.id) || riskIds.has(risk.id))
      return `Id de riesgo repetido: ${risk.id}`;
    riskIds.add(risk.id);
    ids.add(risk.id);
    if (!validRiskCategories.has(risk.category))
      return `Categoría inválida en riesgo ${risk.id}`;
    if (!validRiskStatuses.has(risk.status))
      return `Estado inválido en riesgo ${risk.id}`;
    if (
      !Number.isInteger(risk.probability) ||
      risk.probability < 1 ||
      risk.probability > 5
    )
      return `La probabilidad del riesgo ${risk.id} debe ser un entero entre 1 y 5`;
    if (!Number.isInteger(risk.impact) || risk.impact < 1 || risk.impact > 5)
      return `El impacto del riesgo ${risk.id} debe ser un entero entre 1 y 5`;
    if (
      risk.probability * risk.impact >= 10 &&
      (!risk.owner_id || !risk.mitigation_plan?.trim() || !risk.review_date)
    )
      return `Un riesgo alto o crítico requiere responsable, mitigación y fecha de revisión: ${risk.id}`;
    if (risk.owner_id != null && !people.has(risk.owner_id))
      return `Persona inexistente en riesgo ${risk.id}: ${risk.owner_id}`;
    if (
      !date.test(risk.identified_at) ||
      (risk.review_date != null && !date.test(risk.review_date))
    )
      return `Fecha inválida en riesgo ${risk.id}`;
    if (risk.related_sprint != null && !sprints.has(risk.related_sprint))
      return `Sprint inexistente en riesgo ${risk.id}`;
    if (
      !Array.isArray(risk.related_feature_ids) ||
      risk.related_feature_ids.some((id) => !features.has(id))
    )
      return `Funcionalidad inexistente en riesgo ${risk.id}`;
  }

  for (const incident of p.riskRegister.incidents) {
    if (!incident.id || ids.has(incident.id))
      return `Id de incidente repetido: ${incident.id}`;
    ids.add(incident.id);
    ids.add(incident.id);
    if (!validIncidentStatuses.has(incident.status))
      return `Estado inválido en incidente ${incident.id}`;
    if (!validSeverities.has(incident.severity))
      return `Severidad inválida en incidente ${incident.id}`;
    if (
      !date.test(incident.occurred_at) ||
      !date.test(incident.detected_at) ||
      (incident.resolved_at != null && !date.test(incident.resolved_at))
    )
      return `Fecha inválida en incidente ${incident.id}`;
    if (incident.owner_id != null && !people.has(incident.owner_id))
      return `Persona inexistente en incidente ${incident.id}: ${incident.owner_id}`;
    if (incident.risk_id != null && !riskIds.has(incident.risk_id))
      return `Riesgo inexistente en incidente ${incident.id}: ${incident.risk_id}`;
    if (
      !Array.isArray(incident.related_feature_ids) ||
      incident.related_feature_ids.some((id) => !features.has(id))
    )
      return `Funcionalidad inexistente en incidente ${incident.id}`;
    if (
      (incident.status === "resolved" || incident.status === "closed") &&
      (!incident.resolution?.trim() || !incident.lessons_learned?.trim())
    )
      return `Un incidente resuelto requiere resolución y lecciones aprendidas: ${incident.id}`;
  }
  return null;
}

export async function writePlan(plan: Plan): Promise<void> {
  await Promise.all([
    writeYaml(FILES.backlog, plan.backlog),
    writeYaml(FILES.team, plan.team),
    writeYaml(FILES.risks, plan.riskRegister),
  ]);
}

/** Rutas del prototipo relativas a su raiz, para el autocompletado del editor. */
export async function listPrototypeFiles(): Promise<string[]> {
  if (!existsSync(PROTOTYPE_ROOT)) return [];

  const found: string[] = [];
  const skip = new Set(["node_modules", ".next", ".git"]);

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/\.(tsx|ts|css|md)$/.test(entry.name)) {
        found.push(path.relative(PROTOTYPE_ROOT, full));
      }
    }
  }

  await walk(PROTOTYPE_ROOT);
  return found.sort();
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Middleware que atiende /api/*. Se monta tanto en dev como en preview. */
export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): Promise<void> {
  const url = (req.url ?? "").split("?")[0];
  if (!url.startsWith("/api/")) return next();

  try {
    if (url === "/api/plan" && req.method === "GET") {
      return json(res, 200, await readPlan());
    }

    if (url === "/api/plan" && req.method === "PUT") {
      const plan = JSON.parse(await readBody(req)) as Plan;
      const error = validate(plan);
      if (error) return json(res, 400, { error });
      await writePlan(plan);
      return json(res, 200, { ok: true, savedAt: new Date().toISOString() });
    }

    if (url === "/api/prototype-files" && req.method === "GET") {
      return json(res, 200, { files: await listPrototypeFiles() });
    }

    return json(res, 404, { error: `Ruta desconocida: ${req.method} ${url}` });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
