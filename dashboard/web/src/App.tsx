import { useEcosystemSnapshot } from "./hooks/useEcosystemSnapshot.js";
import { OverviewPanel } from "./components/OverviewPanel.js";
import { RepoList } from "./components/RepoList.js";
import { AgentPanel } from "./components/AgentPanel.js";
import { BottlenecksPanel } from "./components/BottlenecksPanel.js";
import { EcosystemGraphPanel } from "./components/EcosystemGraphPanel.js";
import { SiteHeader } from "./components/SiteHeader.js";
import { UNKNOWN } from "@ecosystem/types";

export default function App() {
  const state = useEcosystemSnapshot();

  return (
    <>
      <SiteHeader current="dashboard" />
      <main id="main" className="wrap">
        <div className="page-head">
          <h1>エコシステムダッシュボード</h1>
          <p className="lede">
            読み取り専用の観測レイヤー。開発の進み具合は<a href={`${import.meta.env.BASE_URL}control-room.html`}>コントロールルーム</a>で見られます。
          </p>
        </div>

        {state.status === "loading" && <div className="loading-state">エコシステムのスナップショットを読み込み中…</div>}

        {state.status === "error" && (
          <div className="error-banner" role="alert">
            <strong>エコシステムのスナップショットを読み込めませんでした。</strong>
            <div className="detail">{state.message}</div>
            <div className="hint">
              このダッシュボードは常に静的な生成済みJSONファイルのみを読み込みます — GitHubを直接呼び出すことはありません（dashboard/README.md参照）。デプロイ直後の場合、集計ワークフローがまだ実行されていない可能性があります。
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <>
            {state.snapshot.unreachableRepos.length > 0 && (
              <div className="error-banner">
                <strong>registry.json内の{state.snapshot.unreachableRepos.length}件のリポジトリに到達できませんでした：</strong>
                <ul>
                  {state.snapshot.unreachableRepos.map((r) => (
                    <li key={r.slug}>
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
            <span>GitHub APIアクセス：{state.snapshot.authTokenPresent ? "認証あり" : "認証なし"}</span>
            <span>
              レート制限 {state.snapshot.rateLimit.remaining === UNKNOWN ? "不明" : `${state.snapshot.rateLimit.remaining}/${state.snapshot.rateLimit.limit}`}
            </span>
          </div>
        </footer>
      )}
    </>
  );
}
