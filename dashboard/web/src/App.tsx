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
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Ecosystem Dashboard — read-only observation layer</div>
      </header>

      {state.status === "loading" && <div className="loading-state">Loading ecosystem snapshot…</div>}

      {state.status === "error" && (
        <div className="error-banner">
          <strong>Could not load the ecosystem snapshot.</strong>
          <div style={{ marginTop: 4, fontSize: 13 }}>{state.message}</div>
          <div style={{ marginTop: 8, fontSize: 12.5 }}>
            This Dashboard only ever reads a static, pre-generated JSON file — it never calls GitHub directly (see
            dashboard/README.md). If this is a fresh deployment, the aggregation workflow may not have run yet.
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {state.snapshot.unreachableRepos.length > 0 && (
            <div className="error-banner">
              <strong>{state.snapshot.unreachableRepos.length} repo(s) in registry.json could not be reached:</strong>
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
            Generated {new Date(state.snapshot.generatedAt).toLocaleString()} by {state.snapshot.generator.name}{" "}
            v{state.snapshot.generator.version}
            {" · "}
            {state.snapshot.authTokenPresent ? "authenticated" : "unauthenticated"} GitHub API access
            {" · "}
            rate limit {state.snapshot.rateLimit.remaining === UNKNOWN ? "UNKNOWN" : `${state.snapshot.rateLimit.remaining}/${state.snapshot.rateLimit.limit}`}
          </div>
        </>
      )}
    </div>
  );
}
