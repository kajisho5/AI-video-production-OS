// Generate the ecosystem org charts from ecosystem.json, so the picture can never disagree with
// the manifest the installer uses.
//
//   node scripts/orgchart.mjs [out-dir]        # default: docs/ecosystem/org
//
// Writes overview.html plus one <department>.html, and renders each to .png when Playwright is
// resolvable (`npm i -D playwright` or a global install); without it, only the HTML is written.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(process.argv[2] ?? join(ROOT, "docs/ecosystem/org"));
const manifest = JSON.parse(readFileSync(join(ROOT, "ecosystem.json"), "utf8"));
const { departments, components } = manifest;
const onHold = manifest.on_hold ?? [];

const STATUS = {
  active: { label: "稼働", cls: "active" },
  scaffold: { label: "骨組みのみ", cls: "scaffold" },
  planned: { label: "未作成", cls: "planned" },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const members = (id) => components.filter((c) => c.department === id);
const badges = (c) =>
  `<span class="badge ${STATUS[c.status].cls}">${STATUS[c.status].label}</span>` +
  (c.optional ? `<span class="badge optional">オプション</span>` : "");

const CSS = `
:root { --ink:#1b2430; --sub:#5b6675; --line:#c9d1dc; --bg:#f6f8fb; --card:#fff; --accent:#2f5bea; }
* { box-sizing:border-box; margin:0; }
body { font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif; color:var(--ink); background:var(--bg); padding:40px; width:max-content; min-width:900px; }
h1 { font-size:30px; letter-spacing:.02em; } h1 small { font-size:15px; color:var(--sub); font-weight:500; margin-left:12px; }
.lead { color:var(--sub); font-size:14px; margin:6px 0 28px; }
.badge { display:inline-block; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; margin-left:6px; vertical-align:2px; white-space:nowrap; }
.badge.active { background:#e3f6ea; color:#17733a; } .badge.scaffold { background:#fff3d6; color:#8a5a00; }
.badge.planned { background:#eceff3; color:#5b6675; } .badge.optional { background:#e6edff; color:#2f5bea; }
.node { background:var(--card); border:1.5px solid var(--line); border-radius:12px; padding:12px 16px; }
.node.planned { border-style:dashed; background:#fbfcfd; }
.node .repo { font-weight:700; font-size:15px; }
.node .owns { color:var(--sub); font-size:12px; margin-top:4px; line-height:1.5; }
.top { display:flex; justify-content:center; }
.top .node { border:2px solid var(--accent); min-width:420px; text-align:center; }
.dept-label { font-size:12px; font-weight:700; color:var(--accent); letter-spacing:.08em; }
.vline { width:2px; height:28px; background:var(--line); margin:0 auto; }
.branches { display:flex; gap:18px; position:relative; padding-top:28px; }
.branches::before { content:""; position:absolute; top:0; left:calc(var(--first) * 1px); right:calc(var(--last) * 1px); height:2px; background:var(--line); }
.col { width:230px; position:relative; }
.col::before { content:""; position:absolute; top:-28px; left:50%; width:2px; height:28px; background:var(--line); }
.col .head { background:var(--ink); color:#fff; border-radius:10px; padding:10px 14px; text-align:center; font-weight:700; font-size:16px; }
.col .head small { display:block; font-weight:500; font-size:11px; opacity:.7; letter-spacing:.08em; }
.col .list { display:flex; flex-direction:column; gap:10px; margin-top:12px; padding-left:14px; border-left:2px solid var(--line); }
.col .list .node { padding:9px 12px; } .col .list .repo { font-size:13px; }
.base { margin-top:26px; background:#eef2ff; border:2px solid var(--accent); border-radius:12px; padding:14px 18px; text-align:center; }
.base .repo { font-weight:700; font-size:16px; } .base .owns { color:var(--sub); font-size:12px; margin-top:4px; }
.hold { margin-top:22px; border:1.5px dashed var(--line); border-radius:12px; padding:12px 16px; color:var(--sub); font-size:12px; }
.hold b { color:var(--ink); }
.legend { margin-top:18px; font-size:12px; color:var(--sub); }
.grid { display:grid; grid-template-columns:repeat(var(--cols), 360px); gap:18px; margin-top:8px; }
.card { background:var(--card); border:1.5px solid var(--line); border-radius:14px; padding:16px 18px; }
.card.planned { border-style:dashed; background:#fbfcfd; }
.card .repo { font-weight:700; font-size:17px; }
.card .role { color:var(--sub); font-size:12px; margin:6px 0 10px; line-height:1.5; }
.card h3 { font-size:11px; letter-spacing:.08em; color:var(--accent); margin:10px 0 6px; }
.chips { display:flex; flex-wrap:wrap; gap:6px; }
.chip { font-size:12px; background:#f1f4f8; border-radius:6px; padding:3px 8px; }
.engine { font-size:12px; line-height:1.6; } .engine b { font-weight:700; } .engine span { color:var(--sub); }
`;

const page = (title, body) =>
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

function overview() {
  const agent = components.find((c) => c.department === "command");
  const engine = components.find((c) => c.department === "engine");
  const cols = departments.filter((d) => !["command", "engine"].includes(d.id));
  const colW = 230, gap = 18, half = colW / 2;
  const body = `
<h1>AI Video Production OS 組織図<small>ecosystem.json から生成</small></h1>
<p class="lead">司令塔が各部門のスキルを呼び分け、各スキルは実行基盤の ffmpeg-skill の上で動く。</p>
<div class="top"><div class="node"><div class="dept-label">司令塔 COMMAND</div>
  <div class="repo">${esc(agent.repo)}${badges(agent)}</div><div class="owns">${agent.owns.map(esc).join(" ・ ")}</div></div></div>
<div class="vline"></div>
<div class="branches" style="--first:${half};--last:${half}">
${cols.map((d) => `<div class="col"><div class="head">${esc(d.name)}<small>${esc(d.en.toUpperCase())}</small></div><div class="list">
${members(d.id).map((c) => `<div class="node ${c.status === "planned" ? "planned" : ""}"><div class="repo">${esc(c.repo)}</div><div>${badges(c)}</div><div class="owns">${c.owns.map(esc).join(" ・ ")}</div></div>`).join("")}
</div></div>`).join("")}
</div>
<div class="base" style="width:${cols.length * colW + (cols.length - 1) * gap}px"><div class="dept-label">実行基盤 ENGINE</div>
  <div class="repo">${esc(engine.repo)}${badges(engine)}</div><div class="owns">${engine.owns.map(esc).join(" ・ ")}</div></div>
${onHold.length ? `<div class="hold"><b>保留(採否未決)</b>: ${onHold.map((h) => `${esc(h.repo)}(${esc(h.note)})`).join(" / ")}</div>` : ""}
<p class="legend">稼働 = 実装あり / 骨組みのみ = リポジトリはあるが中身未実装 / 未作成 = リポジトリ未作成(インストール対象外) / オプション = --with-optional で導入</p>`;
  return page("組織図", body);
}

function department(d) {
  const ms = members(d.id);
  const cols = Math.min(3, ms.length);
  const body = `
<h1>${esc(d.name)}部門<small>${esc(d.en)}</small></h1>
<p class="lead">担当(owns)は部門をまたいで重複しない。ここに無い仕事は担当スキルへ渡す。</p>
<div class="grid" style="--cols:${cols}">
${ms.map((c) => `<div class="card ${c.status === "planned" ? "planned" : ""}">
  <div class="repo">${esc(c.repo)}${badges(c)}</div>
  <div class="role">${esc(c.role)}</div>
  <h3>担当</h3><div class="chips">${c.owns.map((o) => `<span class="chip">${esc(o)}</span>`).join("")}</div>
  ${c.engines?.length ? `<h3>エンジン</h3>${c.engines.map((e) => `<div class="engine"><b>${esc(e.name)}</b> <span>${esc(e.note ?? "")}</span></div>`).join("")}` : ""}
</div>`).join("")}
</div>`;
  return page(`${d.name}部門`, body);
}

mkdirSync(OUT, { recursive: true });
const pages = [["overview", overview()], ...departments.map((d) => [d.id, department(d)])];
for (const [name, html] of pages) writeFileSync(join(OUT, `${name}.html`), html);

let chromium;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  console.log(`wrote ${pages.length} HTML files to ${OUT} (Playwright not found: no PNG)`);
  process.exit(0);
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 900, height: 600 } });
for (const [name] of pages) {
  const p = await ctx.newPage();
  await p.goto("file://" + join(OUT, `${name}.html`));
  await p.evaluate(() => document.fonts.ready);
  await p.locator("body").screenshot({ path: join(OUT, `${name}.png`) });
  await p.close();
}
await browser.close();
console.log(`wrote ${pages.length} HTML + PNG files to ${OUT}`);
