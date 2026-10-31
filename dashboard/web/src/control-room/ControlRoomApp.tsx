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
import { SiteHeader } from "../components/SiteHeader.js";

export default function ControlRoomApp() {
  const state = useControlRoomSnapshot();

  return (
    <>
      <SiteHeader current="control-room" />
      <main id="main" className="wrap">
        <div className="page-head">
          <h1>Ecosystem Control Room</h1>
          <p className="lede">AI Video Production OS — 開発状況の横断ビュー（読み取り専用・制御プレーン）</p>
          <p className="lede" style={{ marginTop: "var(--space-1)" }}>
            OSの現状は<a href={import.meta.env.BASE_URL}>エコシステムダッシュボード</a>で見られます。
          </p>
        </div>

        {state.status === "loading" && <div className="loading-state">コントロールルームのスナップショットを読み込み中…</div>}

        {state.status === "error" && (
          <div className="error-banner" role="alert">
            <strong>スナップショットを読み込めませんでした。</strong>
            <div className="detail">{state.message}</div>
            <div className="hint">
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
          </>
        )}
      </main>

      {state.status === "ready" && (
        <footer className="site-footer">
          <div className="wrap meta">
            <span>{new Date(state.snapshot.generatedAt).toLocaleString("ja-JP")} 生成</span>
            <span>
              {state.snapshot.generator.name} v{state.snapshot.generator.version}
            </span>
          </div>
        </footer>
      )}
    </>
  );
}
