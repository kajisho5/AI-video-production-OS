import { useEcosystemSnapshot } from "./hooks/useEcosystemSnapshot.js";
import { OverviewPanel } from "./components/OverviewPanel.js";
import { RepoList } from "./components/RepoList.js";
import { AgentPanel } from "./components/AgentPanel.js";
import { BottlenecksPanel } from "./components/BottlenecksPanel.js";
import { EcosystemGraphPanel } from "./components/EcosystemGraphPanel.js";
import { UNKNOWN } from "@ecosystem/types";

export default function App() {
  const state = useEcosystemSnapshot();

  return (
    <div className="app-shell">
      <header style={{ marginBottom: "var(--space-5)" }}>
        <h1 style={{ fontSize: 20 }}>AI Video Production OS</h1>
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>エコシステムダッシュボード — 読み取り専用の観測レイヤー</div>
      </header>

      {state.status === "loading" && <div className="loading-state">エコシステムのスナップショットを読み込み中…</div>}

      {state.status === "error" && (
        <div className="error-banner">
          <strong>エコシステムのスナップショットを読み込めませんでした。</strong>
          <div style={{ marginTop: 4, fontSize: 13 }}>{state.message}</div>
          <div style={{ marginTop: 8, fontSize: 12.5 }}>
            このダッシュボードは常に静的な生成済みJSONファイルのみを読み込みます — GitHubを直接呼び出すことはありません（dashboard/README.md参照）。デプロイ直後の場合、集計ワークフローがまだ実行されていない可能性があります。
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {state.snapshot.unreachableRepos.length > 0 && (
            <div className="error-banner">
              <strong>registry.json内の{state.snapshot.unreachableRepos.length}件のリポジトリに到達できませんでした：</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
                {state.snapshot.unreachableRepos.map((r) => (
                  <li key={r.slug} style={{ fontSize: 13 }}>
                    <span className="mono">{r.slug}</span> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <OverviewPanel overview={state.snapshot.overview} />
          <BottlenecksPanel bottlenecks={state.snapshot.bottlenecks} />
          <AgentPanel agent={state.snapshot.agent} />
          <RepoList repos={state.snapshot.repos} />
          <EcosystemGraphPanel graph={state.snapshot.graph} />

          <div className="footer-note">
            {new Date(state.snapshot.generatedAt).toLocaleString("ja-JP")} 生成 · {state.snapshot.generator.name}{" "}
            v{state.snapshot.generator.version}
            {" · "}
            GitHub APIアクセス：{state.snapshot.authTokenPresent ? "認証あり" : "認証なし"}
            {" · "}
            レート制限 {state.snapshot.rateLimit.remaining === UNKNOWN ? "不明" : `${state.snapshot.rateLimit.remaining}/${state.snapshot.rateLimit.limit}`}
          </div>
        </>
      )}
    </div>
  );
}
