import type { Task } from "@ecosystem/control-room-types";
import { UNKNOWN } from "@ecosystem/control-room-types";
import { StatusChip } from "../../components/StatusChip.js";
import { Section } from "../../components/Section.js";
import { lifecycleLabel, lifecycleTone } from "../lifecycleTone.js";
import { useI18n, type MessageKey } from "../../lib/i18n.js";

const DONE_LIKE = new Set(["DONE", "VERIFIED", "MERGED", "DEFERRED"]);

/** Sections D + E of the task spec, in one panel split into two groups: "Active
 * work" (already moving -- has a PR, or a closed/settled status) and "Pre-PR work"
 * (planned/ready but no PR yet). The task's own words: a pre-PR task "must NOT
 * appear as nothing happening" and must be visibly distinct from "blocked" or
 * "doesn't exist" -- so every task from WORK_QUEUE.md is always shown here, with
 * its own real status, never hidden. */
export function TasksPanel({ tasks }: { tasks: Task[] }) {
  const active = tasks.filter((task) => !DONE_LIKE.has(task.status) && task.pullRequests.length > 0);
  const done = tasks.filter((task) => DONE_LIKE.has(task.status));
  const prePr = tasks.filter((task) => !DONE_LIKE.has(task.status) && task.pullRequests.length === 0);

  const { t } = useI18n();
  return (
    <Section title={t("tasks.title", { count: tasks.length })} defaultOpen>
      <TaskGroup title={t("tasks.active")} tasks={active} emptyText={t("tasks.activeEmpty")} />
      <TaskGroup title={t("tasks.prePr")} tasks={prePr} emptyText={t("tasks.prePrEmpty")} />
      <TaskGroup title={t("tasks.done")} tasks={done} emptyText={t("tasks.doneEmpty")} />
    </Section>
  );
}

function TaskGroup({ title, tasks, emptyText }: { title: string; tasks: Task[]; emptyText: string }) {
  const { t } = useI18n();
  return (
    <div className="task-group">
      <h3>{title}</h3>
      {tasks.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        <ul className="rows">
          {tasks.map((task) => (
            <li key={task.id} className="row">
              <div className="row-head">
                <strong className="row-title">
                  {task.id}. {task.title}
                </strong>
                <StatusChip label={lifecycleLabel(t, task.status)} tone={lifecycleTone(task.status)} />
              </div>
              {task.isRecommendedNext && (
                <div className="chips">
                  <span className="status-chip mark">{t("tasks.recommended")}</span>
                </div>
              )}
              {task.phaseId !== UNKNOWN && <div className="note">{task.phaseId}</div>}
              {task.pullRequests.length > 0 && (
                <div>
                  {task.pullRequests.map((pr, i) => (
                    <div key={i} className="note">
                      {pr.repoSlug === UNKNOWN ? t("tasks.unknownRepo") : pr.repoSlug}#{pr.number} —{" "}
                      {t(prStateKey(pr))}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function prStateKey(pr: Task["pullRequests"][number]): MessageKey {
  if (pr.resolution === "resolved" && pr.state) {
    if (pr.state.merged) return "tasks.pr.merged";
    if (pr.state.state === "open") return pr.state.draft ? "tasks.pr.draft" : "tasks.pr.open";
    return "tasks.pr.closed";
  }
  if (pr.resolution === "not_found") return "tasks.pr.notFound";
  if (pr.resolution === "ambiguous_repo") return "tasks.pr.ambiguous";
  return "tasks.pr.unresolved";
}
