/**
 * Live version lookups against npm's and PyPI's own public registry APIs -- the
 * MATURITY_MODEL.md level 6 ("Distributed") automatic evidence this project's own
 * dashboard/README.md "Known gaps" previously named as missing. Neither registry
 * requires authentication for a public package read, so this never touches a token.
 */
import { UNKNOWN } from "../../shared/types.js";
import type { Unknown } from "../../shared/types.js";

export interface PackageVersionLookup {
  version: string | Unknown;
  /** Present only on failure, so a caller can tell "package genuinely has no version"
   * (should not happen) apart from "the lookup itself failed" (network, 404, ...). */
  error?: string;
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchLatestNpmVersion(packageName: string): Promise<PackageVersionLookup> {
  try {
    const doc = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`);
    const version = doc?.version;
    if (typeof version !== "string") return { version: UNKNOWN, error: "npm registry response had no 'version' field" };
    return { version };
  } catch (err) {
    return { version: UNKNOWN, error: `npm registry lookup failed: ${(err as Error).message}` };
  }
}

export async function fetchLatestPypiVersion(packageName: string): Promise<PackageVersionLookup> {
  try {
    const doc = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`);
    const version = doc?.info?.version;
    if (typeof version !== "string") return { version: UNKNOWN, error: "PyPI response had no 'info.version' field" };
    return { version };
  } catch (err) {
    return { version: UNKNOWN, error: `PyPI lookup failed: ${(err as Error).message}` };
  }
}

export async function fetchLatestVersion(kind: "npm" | "pypi", packageName: string): Promise<PackageVersionLookup> {
  return kind === "npm" ? fetchLatestNpmVersion(packageName) : fetchLatestPypiVersion(packageName);
}
