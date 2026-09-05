/**
 * Loads the two structured ecosystem-state files this project maintains
 * (docs/ecosystem/registry.json, docs/ecosystem/capability-status.json).
 * These are read from disk, not fetched over the network -- the aggregator always
 * runs with a checkout of AI-video-production-OS available (it IS this repo's own
 * CI job).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ECOSYSTEM_DIR = path.resolve(__dirname, "../../../docs/ecosystem");

export interface RegistryRepo {
  slug: string;
  name: string;
  type: "OS" | "Agent" | "Skill" | "Provider" | "Extension";
  role: string;
  depends_on: string[];
}

export interface RegistryFile {
  schema_version: number;
  updated_at: string;
  repos: RegistryRepo[];
}

export interface CapabilityStatusRepoEntry {
  contract_published?: boolean;
  provides_published?: boolean;
  provides_evidence?: string;
  os_integration?: string;
  os_integration_evidence?: string;
  verified_e2e?: string;
  verified_e2e_evidence?: string;
  distribution?: { kind: string; package: string; note?: string };
  as_of?: string;
  [key: string]: unknown;
}

export interface CapabilityStatusFile {
  schema_version: number;
  updated_at: string;
  repos: Record<string, CapabilityStatusRepoEntry>;
}

export function loadRegistry(dir: string = ECOSYSTEM_DIR): RegistryFile {
  const raw = readFileSync(path.join(dir, "registry.json"), "utf-8");
  return JSON.parse(raw) as RegistryFile;
}

export function loadCapabilityStatus(dir: string = ECOSYSTEM_DIR): CapabilityStatusFile {
  const raw = readFileSync(path.join(dir, "capability-status.json"), "utf-8");
  return JSON.parse(raw) as CapabilityStatusFile;
}

export { ECOSYSTEM_DIR };
