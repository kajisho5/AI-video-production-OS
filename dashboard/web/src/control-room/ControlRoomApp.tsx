import { useControlRoomSnapshot } from "./useControlRoomSnapshot.js";
import { ObjectivePanel } from "./components/ObjectivePanel.js";
import { NextTaskPanel } from "./components/NextTaskPanel.js";
import { TasksPanel } from "./components/TasksPanel.js";
import { PhasesPanel } from "./components/PhasesPanel.js";
import { BlockersPanel } from "./components/BlockersPanel.js";
import { RepositoriesPanel } from "./components/RepositoriesPanel.js";
import { IntelligencePanel } from "./components/IntelligencePanel.js";
import { VerificationPanel } from "./components/VerificationPanel.js";
import { RoadmapDriftPanel } from "./components/RoadmapDriftPanel.js";

export default function ControlRoomApp() {
  const state = useControlRoomSnapshot();

  return (
    <div className="app-shell">
      <header style={{ marginBottom: "var(--space-5)" }}>
        <h1 style={{ fontSize: 20 }}>Ecosystem Control Room</h1>
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          AI Video Production OS — 開発状況の横断ビュー（読み取り専用・制御プレーン）
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>
          <a href="./index.html" style={{ color: "inherit" }}>
            ← エコシステムダッシュボード（OSの現状）へ
          </a>
        </div>
      </header>

      {state.status === "loading" && <div className="loading-state">コントロールルームのスナップショットを読み込み中…</div>}

      {state.status === "error" && (
        <div className="error-banner">
          <strong>スナップショットを読み込めませんでした。</strong>
          <div style={{ marginTop: 4, fontSize: 13 }}>{state.message}</div>
          <div style={{ marginTop: 8, fontSize: 12.5 }}>
            dashboard/control-room の生成ワークフローがまだ実行されていない可能性があります（<span className="mono">npm run generate</span>）。
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <ObjectivePanel objective={state.snapshot.objective} />
          <NextTaskPanel next={state.snapshot.nextExecutableTask} />
          <RoadmapDriftPanel drifts={state.snapshot.roadmapDrift} />
          <BlockersPanel blockers={state.snapshot.blockers} />
          <TasksPanel tasks={state.snapshot.tasks} />
          <PhasesPanel phases={state.snapshot.phases} />
          <RepositoriesPanel repos={state.snapshot.repositories} unreachable={state.snapshot.unreachableRepos} />
          <IntelligencePanel si={state.snapshot.systemIntelligence} />
          <VerificationPanel records={state.snapshot.verification} />

          <div className="footer-note">
            {new Date(state.snapshot.generatedAt).toLocaleString("ja-JP")} 生成 · {state.snapshot.generator.name} v{state.snapshot.generator.version}
          </div>
        </>
      )}
    </div>
  );
}
