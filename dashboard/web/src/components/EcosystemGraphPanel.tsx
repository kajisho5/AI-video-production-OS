import type { EcosystemGraph, RepoType } from "@ecosystem/types";
import { Section } from "./Section.js";
import { REPO_TYPE_LABEL_JA } from "../lib/labels.js";

const TIER_ORDER: RepoType[] = ["OS", "Agent", "Skill", "Provider", "Extension"];

/** v1, deliberately simple per the task's own instruction: a tiered list grouped by
 * repo type (real data, from registry.json's `type` field) plus the real `depends_on`
 * edges -- not a force-directed graph, no layout library. The task's own
 * OS -> Agent -> Capabilities -> Skills -> Providers -> Runtime -> Artifacts ->
 * Verification pipeline is a conceptual data-flow, not something this repo roster maps
 * onto 1:1 (Capabilities/Runtime/Artifacts/Verification are not repositories); showing
 * repository-level tiers plus real dependency edges is what is actually backed by
 * evidence today. */
export function EcosystemGraphPanel({ graph }: { graph: EcosystemGraph }) {
  const nodesByType = new Map<RepoType, string[]>();
  for (const node of graph.nodes) {
    const list = nodesByType.get(node.type) ?? [];
    list.push(node.slug);
    nodesByType.set(node.type, list);
  }

  const edgesByFrom = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = edgesByFrom.get(edge.from) ?? [];
    list.push(edge.to);
    edgesByFrom.set(edge.from, list);
  }

  return (
    <Section title="エコシステム構成図">
      <div className="graph-list">
        {TIER_ORDER.filter((t) => nodesByType.has(t)).map((type) => (
          <div key={type}>
            <div className="graph-tier-label">{REPO_TYPE_LABEL_JA[type]}</div>
            <div className="graph-tier">
              {nodesByType.get(type)!.map((slug) => (
                <span key={slug} className="graph-node" title={slug}>
                  {slug.split("/")[1]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "var(--space-4)" }}>
        <div className="panel-title">依存関係</div>
        <div style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 4 }}>
          {[...edgesByFrom.entries()].map(([from, tos]) => (
            <div key={from}>
              <span className="mono">{from.split("/")[1]}</span>
              <span className="graph-arrow"> {"->"} </span>
              {tos.map((to) => to.split("/")[1]).join(", ")}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
