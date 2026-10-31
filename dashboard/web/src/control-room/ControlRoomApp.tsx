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
import { LanguageProvider } from "../components/LanguageProvider.js";
import { useI18n, withLang } from "../lib/i18n.js";

export default function ControlRoomApp() {
  return (
    <LanguageProvider page="control-room">
      <ControlRoom />
    </LanguageProvider>
  );
}

function ControlRoom() {
  const state = useControlRoomSnapshot();
  const { t, lang, locale } = useI18n();

  return (
    <>
      <SiteHeader current="control-room" />
      <main id="main" className="wrap">
        <div className="page-head">
          <h1>{t("controlRoom.title")}</h1>
          <p className="lede">{t("controlRoom.lede")}</p>
          <p className="lede" style={{ marginTop: "var(--space-1)" }}>
            {t("controlRoom.lede2.before")}
            <a href={withLang(import.meta.env.BASE_URL, lang)}>{t("controlRoom.lede2.link")}</a>
            {t("controlRoom.lede2.after")}
          </p>
        </div>

        {state.status === "loading" && <div className="loading-state">{t("controlRoom.loading")}</div>}

        {state.status === "error" && (
          <div className="error-banner" role="alert">
            <strong>{t("controlRoom.error.title")}</strong>
            <div className="detail">{state.message}</div>
            <div className="hint">
              {t("controlRoom.error.hint.before")}
              <span className="mono">npm run generate</span>
              {t("controlRoom.error.hint.after")}
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
            <span>{t("common.generatedAt", { date: new Date(state.snapshot.generatedAt).toLocaleString(locale) })}</span>
            <span>
              {state.snapshot.generator.name} v{state.snapshot.generator.version}
            </span>
          </div>
        </footer>
      )}
    </>
  );
}
