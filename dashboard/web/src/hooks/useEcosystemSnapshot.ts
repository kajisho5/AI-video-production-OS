import { useEffect, useState } from "react";
import type { EcosystemSnapshot } from "@ecosystem/types";

export type SnapshotState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: EcosystemSnapshot };

declare global {
  // eslint-disable-next-line no-var
  var __ECOSYSTEM_SNAPSHOT_PREVIEW__: EcosystemSnapshot | undefined;
}

/** The ONLY network call this entire UI ever makes: a plain GET for the static,
 * aggregator-generated snapshot file. No GitHub API call, no token, ever
 * (docs/adr/ADR-011-ecosystem-dashboard.md). `import.meta.env.BASE_URL` is Vite's own
 * configured base path, so this resolves correctly under GitHub Pages' project-site
 * subpath as well as local dev.
 *
 * The `__ECOSYSTEM_SNAPSHOT_PREVIEW__` global check exists only to let a single
 * self-contained HTML file (e.g. a one-off shareable preview, built by inlining a real
 * snapshot alongside the compiled app) render without a fetch at all. Production and
 * local dev never set this global, so this branch is inert for them. */
export function useEcosystemSnapshot(): SnapshotState {
  const [state, setState] = useState<SnapshotState>({ status: "loading" });

  useEffect(() => {
    if (typeof window !== "undefined" && window.__ECOSYSTEM_SNAPSHOT_PREVIEW__) {
      setState({ status: "ready", snapshot: window.__ECOSYSTEM_SNAPSHOT_PREVIEW__ });
      return;
    }

    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}data/ecosystem-snapshot.json?_=${Date.now()}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
        return res.json();
      })
      .then((data: EcosystemSnapshot) => {
        if (!cancelled) setState({ status: "ready", snapshot: data });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
