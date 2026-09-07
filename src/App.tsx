import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Flag,
  GanttChart,
  ListTodo,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { fetchPlan, fetchPrototypeFiles, savePlan } from "./api";
import type { Plan } from "./types";
import { BacklogTab } from "./components/BacklogTab";
import { FeatureEditor } from "./components/FeatureEditor";
import { SprintsTab } from "./components/SprintsTab";
import { TeamTab } from "./components/TeamTab";
import { TimelineTab } from "./components/TimelineTab";
import { WeekDetail } from "./components/WeekDetail";
import { WeekPanel } from "./components/WeekPanel";
import { RisksTab } from "./components/RisksTab";
import { cn } from "./components/ui";

type Tab =
  "backlog" | "cronograma" | "semana" | "equipo" | "sprints" | "riesgos";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "backlog", label: "Backlog", icon: ListTodo },
  { id: "cronograma", label: "Cronograma", icon: GanttChart },
  { id: "semana", label: "Semana", icon: CalendarDays },
  { id: "equipo", label: "Equipo", icon: Users },
  { id: "sprints", label: "Sprints", icon: Flag },
  { id: "riesgos", label: "Riesgos", icon: ShieldAlert },
];

const SAVE_DEBOUNCE_MS = 800;

export function App() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [prototypeFiles, setPrototypeFiles] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("backlog");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Semana abierta en el panel del cronograma: el jueves de arranque, en ISO. */
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlan()
      .then(setPlan)
      .catch((cause: Error) => setError(cause.message));
    fetchPrototypeFiles()
      .then(setPrototypeFiles)
      .catch(() => setPrototypeFiles([]));
  }, []);

  const update = useCallback((fn: (plan: Plan) => Plan) => {
    setPlan((current) => (current ? fn(current) : current));
    setSaveState("dirty");
  }, []);

  const save = useCallback(async (next: Plan) => {
    setSaveState("saving");
    try {
      await savePlan(next);
      setSaveState("saved");
      setError(null);
    } catch (cause) {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  /**
   * El watcher de Vite ignora project-plan/, asi que la app no se entera si los
   * yaml cambian por afuera: edicion a mano, git pull, o Claude escribiendo los
   * ticket_refs despues de crear los tickets.
   */
  const reload = useCallback(async () => {
    if (
      saveState === "dirty" &&
      !confirm("Tenés cambios sin guardar. ¿Descartarlos?")
    )
      return;
    try {
      setPlan(await fetchPlan());
      setSaveState("idle");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [saveState]);

  // Autoguardado: solo dispara cuando hubo una edicion real del usuario.
  useEffect(() => {
    if (saveState !== "dirty" || !plan) return;
    const timer = setTimeout(() => void save(plan), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [plan, saveState, save]);

  // Aviso del navegador si quedan cambios sin guardar.
  useEffect(() => {
    if (saveState !== "dirty" && saveState !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  if (error && !plan) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-xl">No se pudo leer el plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Revisá que <code>project-plan/features.yaml</code>,{" "}
          <code>project-plan/team.yaml</code> y{" "}
          <code>project-plan/risks.yaml</code> existan y sean YAML válido.
        </p>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="px-6 py-24 text-center text-sm text-muted-foreground">
        Cargando…
      </main>
    );
  }

  const showEditor =
    (tab === "backlog" || tab === "cronograma") && selectedId !== null;
  const showPanel =
    showEditor || (tab === "cronograma" && selectedWeek !== null);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <h1 className="font-display text-lg">
            PitStop <span className="text-brand">Management</span>
          </h1>

          <nav className="flex gap-1">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                  tab === item.id
                    ? "bg-foreground text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {error ? (
              <span className="text-xs text-brand-700">{error}</span>
            ) : null}
            <SaveIndicator
              state={saveState}
              onSave={() => void save(plan)}
              onReload={() => void reload()}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">
        {tab === "backlog" ? (
          <div
            className={cn(
              "gap-6",
              showEditor && "lg:grid lg:grid-cols-[minmax(0,1fr)_420px]",
            )}
          >
            <BacklogTab
              plan={plan}
              update={update}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {showEditor ? (
              <div className="card sticky top-20 mt-6 max-h-[calc(100vh-6rem)] overflow-hidden lg:mt-0">
                <FeatureEditor
                  plan={plan}
                  featureId={selectedId}
                  prototypeFiles={prototypeFiles}
                  update={update}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "cronograma" ? (
          <div
            className={cn(
              "gap-6",
              showPanel && "xl:grid xl:grid-cols-[minmax(0,1fr)_380px]",
            )}
          >
            <TimelineTab
              plan={plan}
              update={update}
              selectedId={selectedId}
              onSelect={setSelectedId}
              selectedWeek={selectedWeek}
              onSelectWeek={(week) => {
                setSelectedWeek(week);
                setSelectedId(null);
              }}
            />
            {showPanel ? (
              <div className="card sticky top-20 mt-6 max-h-[calc(100vh-6rem)] overflow-hidden xl:mt-0">
                {selectedId !== null ? (
                  <div className="flex h-full flex-col">
                    {selectedWeek !== null ? (
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="flex items-center gap-1.5 border-b border-border px-4 py-2
                                   text-[11px] font-semibold text-muted-foreground transition
                                   hover:bg-muted hover:text-foreground"
                      >
                        <ArrowLeft className="size-3.5" />
                        Volver a la semana
                      </button>
                    ) : null}
                    <div className="min-h-0 flex-1">
                      <FeatureEditor
                        plan={plan}
                        featureId={selectedId}
                        prototypeFiles={prototypeFiles}
                        update={update}
                        onClose={() => setSelectedId(null)}
                      />
                    </div>
                  </div>
                ) : (
                  <WeekDetail
                    plan={plan}
                    weekStart={selectedWeek!}
                    onSelect={setSelectedId}
                    onClose={() => setSelectedWeek(null)}
                  />
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "semana" ? <WeekPanel plan={plan} /> : null}
        {tab === "equipo" ? <TeamTab plan={plan} update={update} /> : null}
        {tab === "sprints" ? <SprintsTab plan={plan} update={update} /> : null}
        {tab === "riesgos" ? <RisksTab plan={plan} update={update} /> : null}
      </main>
    </div>
  );
}

function SaveIndicator({
  state,
  onSave,
  onReload,
}: {
  state: SaveState;
  onSave: () => void;
  onReload: () => void;
}) {
  const text = {
    idle: "Sin cambios",
    dirty: "Sin guardar",
    saving: "Guardando…",
    saved: "Guardado",
    error: "Error al guardar",
  }[state];

  const Icon = {
    idle: Check,
    dirty: AlertCircle,
    saving: Loader2,
    saved: Check,
    error: AlertCircle,
  }[state];

  const tone = {
    idle: "text-muted-foreground",
    dirty: "text-[#92400e]",
    saving: "text-muted-foreground",
    saved: "text-[#15803d]",
    error: "text-brand-700",
  }[state];

  const button =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 " +
    "text-xs font-semibold transition hover:bg-muted disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold",
          tone,
        )}
      >
        <Icon
          className={cn("size-3.5", state === "saving" && "animate-spin")}
        />
        {text}
      </span>
      <button
        type="button"
        onClick={onReload}
        disabled={state === "saving"}
        title="Volver a leer los yaml del disco"
        className={button}
      >
        <RefreshCw className="size-3.5" />
        Recargar
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={state === "saving"}
        className={button}
      >
        <Save className="size-3.5" />
        Guardar
      </button>
    </div>
  );
}
