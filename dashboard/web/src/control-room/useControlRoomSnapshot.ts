import { useEffect, useState } from "react";
import type { ControlRoomSnapshot } from "@ecosystem/control-room-types";

export type ControlRoomState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; snapshot: ControlRoomSnapshot };

declare global {
  // eslint-disable-next-line no-var
  var __CONTROL_ROOM_SNAPSHOT_PREVIEW__: ControlRoomSnapshot | undefined;
}

/** The only network call this page makes: a plain GET for the static,
 * control-room-generator-produced snapshot file -- same pattern as the OS
 * Dashboard's own `useEcosystemSnapshot` (no GitHub API call from the browser,
 * ever). */
export function useControlRoomSnapshot(): ControlRoomState {
  const [state, setState] = useState<ControlRoomState>({ status: "loading" });

  useEffect(() => {
    if (typeof window !== "undefined" && window.__CONTROL_ROOM_SNAPSHOT_PREVIEW__) {
      setState({ status: "ready", snapshot: window.__CONTROL_ROOM_SNAPSHOT_PREVIEW__ });
      return;
    }

    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}data/control-room-snapshot.json?_=${Date.now()}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
        return res.json();
      })
      .then((data: ControlRoomSnapshot) => {
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
