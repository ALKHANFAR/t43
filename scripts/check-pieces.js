/* Customer catalog integrity. Provider metadata stays in server-only data/. */
const fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync("pieces.js", "utf8"), ctx);
const P = ctx.window.PIECES || []; let bad = 0;
const metadata = JSON.parse(fs.readFileSync("data/catalog-metadata.json", "utf8"));
const iconSources = JSON.parse(fs.readFileSync("data/tool-icon-sources.json", "utf8"));
const seen = new Set(), pieceNames = new Set();
for (const p of P) {
  const [slug, name, desc, cat, logo, ar] = p; const err = [];
  if (!slug || seen.has(slug)) err.push("slug"); seen.add(slug);
  if (!name) err.push("name");
  if (!desc || desc.trim().length < 10 || /[…\\]$/.test(desc.trim()) || /generated with/i.test(desc)) err.push("description");
  if (!cat) err.push("category");
  if (!ar || ar.trim().length < 6 || !/[\u0600-\u06FF]/.test(ar) || /[\u0660-\u0669]/.test(ar) || ar.length > 80) err.push("arabic description");
  if (logo !== `/siyadah-api/v1/tool-icons/${encodeURIComponent(slug)}` && logo !== '/assets/talkable.svg') err.push("same-origin logo");
  const entry = metadata[slug];
  if (!entry || !/^@activepieces\/[a-z0-9-]+$/.test(entry.pieceName || "") || pieceNames.has(entry.pieceName)) err.push("official piece name");
  if (entry) {
    pieceNames.add(entry.pieceName);
    if (slug !== entry.pieceName.replace(/^@activepieces\/(?:piece-)?/, "")) err.push("slug/package mapping");
    if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(entry.version || "")) err.push("snapshot version");
    if (!/^(https:\/\/cdn\.activepieces\.com\/pieces\/|\/assets\/)/.test(iconSources[slug] || "")) err.push("server-only icon source");
  }
  if (err.length) { bad++; console.log(`  ✗ ${slug}: ${err.join(", ")} — ${JSON.stringify(desc)}`); }
}
if (Object.keys(metadata).length !== P.length || Object.keys(iconSources).length !== P.length) { bad++; console.log("  ✗ private/public catalog row count mismatch"); }
if (/activepieces|cdn\.activepieces|railway\.app/i.test(fs.readFileSync('pieces.js', 'utf8'))) { bad++; console.log("  ✗ execution platform appears in public catalog"); }
if (/activepieces|cdn\.activepieces|railway\.app/i.test(fs.readFileSync('app/chat.js', 'utf8'))) { bad++; console.log("  ✗ execution platform appears in browser client"); }
// Optional exact reconciliation against a freshly fetched official AP registry.
// This file is an input snapshot, not a second checked-in catalog.
if (process.env.CATALOG_LIVE_FILE) {
  const live = JSON.parse(fs.readFileSync(process.env.CATALOG_LIVE_FILE, "utf8"));
  const versions = new Map(live.map(p => [p.name, p.version]));
  const hidden = ['@activepieces/piece-activepieces', '@activepieces/cashfree-payments'].filter(name => versions.has(name)).length;
  if (versions.size !== live.length || P.length !== live.length - hidden || P.some(p => versions.get(metadata[p[0]]?.pieceName) !== metadata[p[0]]?.version)) {
    bad++; console.log("  ✗ official live catalog coverage/version mismatch");
  }
}
console.log(`pieces.js: ${P.length} tools, ${bad} with problems`);
process.exit(bad || P.length < 700 ? 1 : 0);
