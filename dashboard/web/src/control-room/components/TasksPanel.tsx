import type { Task } from "@ecosystem/control-room-types";
import { UNKNOWN } from "@ecosystem/control-room-types";
import { StatusChip } from "../../components/StatusChip.js";
import { Section } from "../../components/Section.js";
import { lifecycleLabelJa, lifecycleTone } from "../lifecycleTone.js";

const DONE_LIKE = new Set(["DONE", "VERIFIED", "MERGED", "DEFERRED"]);

/** Sections D + E of the task spec, in one panel split into two groups: "Active
 * work" (already moving -- has a PR, or a closed/settled status) and "Pre-PR work"
 * (planned/ready but no PR yet). The task's own words: a pre-PR task "must NOT
 * appear as nothing happening" and must be visibly distinct from "blocked" or
 * "doesn't exist" -- so every task from WORK_QUEUE.md is always shown here, with
 * its own real status, never hidden. */
export function TasksPanel({ tasks }: { tasks: Task[] }) {
  const active = tasks.filter((t) => !DONE_LIKE.has(t.status) && t.pullRequests.length > 0);
  const done = tasks.filter((t) => DONE_LIKE.has(t.status));
  const prePr = tasks.filter((t) => !DONE_LIKE.has(t.status) && t.pullRequests.length === 0);

  return (
    <Section title={`タスク (${tasks.length})`} defaultOpen>
      <TaskGroup title="進行中 — PRあり (Active work)" tasks={active} emptyText="現在進行中のPR付きタスクはありません。" />
      <TaskGroup title="PR未作成 — 計画済み/着手可能 (Pre-PR work)" tasks={prePr} emptyText="PR未作成のタスクはありません。" />
      <TaskGroup title="完了・検証済み・保留" tasks={done} emptyText="完了したタスクはまだありません。" />
    </Section>
  );
}

function TaskGroup({ title, tasks, emptyText }: { title: string; tasks: Task[]; emptyText: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px 0" }}>{title}</h3>
      {tasks.length === 0 ? (
        <p className="footer-note">{emptyText}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.map((t) => (
            <li key={t.id} className="panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <strong style={{ fontSize: 13.5 }}>
                  {t.id}. {t.title}
                </strong>
                <StatusChip label={lifecycleLabelJa(t.status)} tone={lifecycleTone(t.status)} />
              </div>
              {t.isRecommendedNext && <div className="status-chip neutral" style={{ marginTop: 6 }}>推奨タスク</div>}
              {t.phaseId !== UNKNOWN && <div className="footer-note">{t.phaseId}</div>}
              {t.pullRequests.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  {t.pullRequests.map((pr, i) => (
                    <div key={i} className="footer-note">
                      {pr.repoSlug === UNKNOWN ? "リポジトリ不明" : pr.repoSlug}#{pr.number} —{" "}
                      {pr.resolution === "resolved" && pr.state ? (pr.state.merged ? "マージ済み" : pr.state.state === "open" ? (pr.state.draft ? "Draft" : "Open") : "Closed") : pr.resolution === "not_found" ? "見つかりません" : pr.resolution === "ambiguous_repo" ? "リポジトリ特定不可" : "未解決"}
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
