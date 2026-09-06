/* Fast structural WCAG 2.1 AA audit with axe-core in jsdom. Fails the build on any violation.
   jsdom has no canvas, so axe cannot compute color-contrast here; those checks are reported as
   "incomplete" (not hidden) and are covered for real by scripts/a11y-lh.mjs in Chrome. */
const { JSDOM, VirtualConsole } = require("jsdom"); const fs = require("fs"); const path = require("path");
const axe = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
(async () => {
  let failed = 0;
  for (const f of process.argv.slice(2)) {
    const vc = new VirtualConsole(); /* silence jsdom's "canvas not implemented" noise */
    const dom = new JSDOM(fs.readFileSync(f, "utf8"), { runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc, url: "https://siyadah-ai.com/" + path.basename(f) });
    dom.window.eval(axe);
    const r = await dom.window.axe.run(dom.window.document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    const inc = r.incomplete.map(i => i.id).join(", ");
    console.log(`${f}: ${r.violations.length} violations, ${r.passes.length} passes` + (inc ? ` (needs Chrome: ${inc})` : ""));
    r.violations.forEach(v => { failed++; console.log(`  ✗ ${v.impact} ${v.id} — ${v.help}`); });
  }
  process.exit(failed ? 1 : 0);
})();
