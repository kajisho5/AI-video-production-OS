import { useEcosystemSnapshot } from "./hooks/useEcosystemSnapshot.js";
import { OverviewPanel } from "./components/OverviewPanel.js";
import { RepoList } from "./components/RepoList.js";
import { AgentPanel } from "./components/AgentPanel.js";
import { BottlenecksPanel } from "./components/BottlenecksPanel.js";
import { EcosystemGraphPanel } from "./components/EcosystemGraphPanel.js";
import { SiteHeader } from "./components/SiteHeader.js";
import { LanguageProvider } from "./components/LanguageProvider.js";
import { useI18n, withLang } from "./lib/i18n.js";
import { UNKNOWN } from "@ecosystem/types";

export default function App() {
  return (
    <LanguageProvider page="dashboard">
      <Dashboard />
    </LanguageProvider>
  );
}

function Dashboard() {
  const state = useEcosystemSnapshot();
  const { t, lang, locale } = useI18n();

  return (
    <>
      <SiteHeader current="dashboard" />
      <main id="main" className="wrap">
        <div className="page-head">
          <h1>{t("dashboard.title")}</h1>
          <p className="lede">
            {t("dashboard.lede.before")}
            <a href={withLang(`${import.meta.env.BASE_URL}control-room.html`, lang)}>{t("dashboard.lede.link")}</a>
            {t("dashboard.lede.after")}
          </p>
        </div>

        {state.status === "loading" && <div className="loading-state">{t("dashboard.loading")}</div>}

        {state.status === "error" && (
          <div className="error-banner" role="alert">
            <strong>{t("dashboard.error.title")}</strong>
            <div className="detail">{state.message}</div>
            <div className="hint">{t("dashboard.error.hint")}</div>
          </div>
        )}

        {state.status === "ready" && (
          <>
            {state.snapshot.unreachableRepos.length > 0 && (
              <div className="error-banner">
                <strong>{t("dashboard.unreachable", { count: state.snapshot.unreachableRepos.length })}</strong>
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
            <span>{t("common.generatedAt", { date: new Date(state.snapshot.generatedAt).toLocaleString(locale) })}</span>
            <span>
              {state.snapshot.generator.name} v{state.snapshot.generator.version}
            </span>
            <span>
              {t("dashboard.footer.apiAccess", {
                state: t(state.snapshot.authTokenPresent ? "dashboard.footer.authenticated" : "dashboard.footer.unauthenticated"),
              })}
            </span>
            <span>
              {t("dashboard.footer.rateLimit", {
                value:
                  state.snapshot.rateLimit.remaining === UNKNOWN
                    ? t("common.unknown")
                    : `${state.snapshot.rateLimit.remaining}/${state.snapshot.rateLimit.limit}`,
              })}
            </span>
          </div>
        </footer>
      )}
    </>
  );
}
