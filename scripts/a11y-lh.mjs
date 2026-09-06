/* WCAG 2.1 AA audit in a real Chrome via Lighthouse (accessibility category, includes color-contrast).
   Serves the repo on a random local port, audits each page, fails the build on any failed audit. */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import lighthouse from "lighthouse"; import * as chromeLauncher from "chrome-launcher";
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".woff2":"font/woff2",".xml":"application/xml",".txt":"text/plain",".webmanifest":"application/manifest+json"};
const root=process.cwd();
const srv=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split("?")[0]); if(p.endsWith("/")) p+="index.html"; const f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end("404"); }
  res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"}); fs.createReadStream(f).pipe(res); });
await new Promise(r=>srv.listen(0,"127.0.0.1",r)); const port=srv.address().port;
const chrome=await chromeLauncher.launch({chromeFlags:["--headless=new","--no-sandbox","--disable-gpu"]});
let failed=0;
try{
  for(const f of process.argv.slice(2)){
    const {lhr}=await lighthouse(`http://127.0.0.1:${port}/${f}`,{port:chrome.port,onlyCategories:["accessibility"],output:"json",logLevel:"error"});
    const bad=Object.values(lhr.audits).filter(a=>a.score===0);
    console.log(`${f}: accessibility ${Math.round(lhr.categories.accessibility.score*100)}/100`);
    for(const a of bad){ failed++; console.log(`  ✗ ${a.id} — ${a.title}`);
      for(const i of (a.details&&a.details.items||[]).slice(0,5)) console.log("     ",i.node&&i.node.selector,"|",((i.node&&i.node.explanation)||"").split("\n")[1]||""); }
  }
}finally{ await chrome.kill(); srv.close(); }
process.exit(failed?1:0);
