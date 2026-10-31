import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // The language choice lives in the URL and localStorage (lib/i18n.ts); start each test
  // from a first visit (English).
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  document.documentElement.lang = "";
});
