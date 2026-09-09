/* Catalog integrity: every tool has a slug, a name, a real one-line description in English and Arabic, a category, and a same-origin or Activepieces-CDN logo. */
const fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync("pieces.js", "utf8"), ctx);
const P = ctx.window.PIECES || []; let bad = 0;
const seen = new Set(), pieceNames = new Set();
for (const p of P) {
  const [slug, name, desc, cat, logo, ar, metadata] = p; const err = [];
  if (!slug || seen.has(slug)) err.push("slug"); seen.add(slug);
  if (!name) err.push("name");
  if (!desc || desc.trim().length < 10 || /[…\\]$/.test(desc.trim()) || /generated with/i.test(desc)) err.push("description");
  if (!cat) err.push("category");
  if (!ar || ar.trim().length < 6 || !/[\u0600-\u06FF]/.test(ar) || /[\u0660-\u0669]/.test(ar) || ar.length > 80) err.push("arabic description");
  if (!/^(https:\/\/cdn\.activepieces\.com\/|\/assets\/)/.test(logo || "")) err.push("logo");
  if (!metadata || !/^@activepieces\/[a-z0-9-]+$/.test(metadata.pieceName || "") || pieceNames.has(metadata.pieceName)) err.push("official piece name");
  if (metadata) {
    pieceNames.add(metadata.pieceName);
    if (slug !== metadata.pieceName.replace(/^@activepieces\/piece-/, "")) err.push("slug/package mapping");
    if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(metadata.version || "")) err.push("live version");
    if (metadata.connectionReadiness !== "unknown") err.push("catalog cannot assert customer connection");
  }
  if (err.length) { bad++; console.log(`  ✗ ${slug}: ${err.join(", ")} — ${JSON.stringify(desc)}`); }
}
// Optional exact reconciliation against a freshly fetched official AP registry.
// This file is an input snapshot, not a second checked-in catalog.
if (process.env.CATALOG_LIVE_FILE) {
  const live = JSON.parse(fs.readFileSync(process.env.CATALOG_LIVE_FILE, "utf8"));
  const versions = new Map(live.map(p => [p.name, p.version]));
  if (versions.size !== live.length || P.length !== live.length || P.some(p => versions.get(p[6]?.pieceName) !== p[6]?.version)) {
    bad++; console.log("  ✗ official live catalog coverage/version mismatch");
  }
}
console.log(`pieces.js: ${P.length} tools, ${bad} with problems`);
process.exit(bad || P.length < 700 ? 1 : 0);
