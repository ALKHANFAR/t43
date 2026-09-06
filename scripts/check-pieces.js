/* Catalog integrity: every tool has a slug, a name, a real one-line description and a same-origin or Activepieces-CDN logo. */
const fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync("pieces.js", "utf8"), ctx);
const P = ctx.window.PIECES || []; let bad = 0;
const seen = new Set();
for (const p of P) {
  const [slug, name, desc, cat, logo] = p; const err = [];
  if (!slug || seen.has(slug)) err.push("slug"); seen.add(slug);
  if (!name) err.push("name");
  if (!desc || desc.trim().length < 10 || /[…\\]$/.test(desc.trim()) || /generated with/i.test(desc)) err.push("description");
  if (!cat) err.push("category");
  if (!/^(https:\/\/cdn\.activepieces\.com\/|\/assets\/)/.test(logo || "")) err.push("logo");
  if (err.length) { bad++; console.log(`  ✗ ${slug}: ${err.join(", ")} — ${JSON.stringify(desc)}`); }
}
console.log(`pieces.js: ${P.length} tools, ${bad} with problems`);
process.exit(bad || P.length < 700 ? 1 : 0);
