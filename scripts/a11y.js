/* WCAG 2.1 AA audit with axe-core in jsdom. Fails the build on any violation. */
const { JSDOM } = require("jsdom"); const fs = require("fs"); const path = require("path");
const axe = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
(async () => {
  let failed = 0;
  for (const f of process.argv.slice(2)) {
    const dom = new JSDOM(fs.readFileSync(f, "utf8"), { runScripts: "outside-only", pretendToBeVisual: true, url: "https://siyadah-ai.com/" + path.basename(f) });
    dom.window.eval(axe);
    const r = await dom.window.axe.run(dom.window.document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    console.log(`${f}: ${r.violations.length} violations, ${r.passes.length} passes`);
    r.violations.forEach(v => { failed++; console.log(`  ✗ ${v.impact} ${v.id} — ${v.help}`); });
  }
  process.exit(failed ? 1 : 0);
})();
