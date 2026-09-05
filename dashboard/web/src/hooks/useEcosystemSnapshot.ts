import { useEffect, useState } from "react";
import type { EcosystemSnapshot } from "@ecosystem/types";

export type SnapshotState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: EcosystemSnapshot };

/** The ONLY network call this entire UI ever makes: a plain GET for the static,
 * aggregator-generated snapshot file. No GitHub API call, no token, ever
 * (docs/adr/ADR-011-ecosystem-dashboard.md). `import.meta.env.BASE_URL` is Vite's own
 * configured base path, so this resolves correctly under GitHub Pages' project-site
 * subpath as well as local dev. */
export function useEcosystemSnapshot(): SnapshotState {
  const [state, setState] = useState<SnapshotState>({ status: "loading" });

  useEffect(() => {
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
