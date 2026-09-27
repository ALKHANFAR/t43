import { createServer } from "node:http";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";

const root = process.cwd();
const port = Number.parseInt(process.env.PORT || "3000", 10);
const openAiKey = String(process.env.OPENAI_API_KEY || "").trim();
const labToken = String(process.env.LAB_ACCESS_TOKEN || "").trim();
const model = String(process.env.OPENAI_MODEL || "gpt-5.4-mini").trim();
const conversations = new Map();
const experimentLedgerPath = String(process.env.EXPERIMENT_LEDGER_PATH || join(root, "data", "experiments.jsonl"));

if (!openAiKey || !labToken) throw new Error("OPENAI_API_KEY and LAB_ACCESS_TOKEN are required");

mkdirSync(dirname(experimentLedgerPath), { recursive: true });
if (!existsSync(experimentLedgerPath)) appendFileSync(experimentLedgerPath, "", { encoding: "utf8" });

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2"
};

function equal(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(request) {
  const cookie = String(request.headers.cookie || "").split(";").map(v => v.trim())
    .find(v => v.startsWith("siy_lab="));
  return cookie && equal(decodeURIComponent(cookie.slice(8)), labToken);
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw Object.assign(new Error("body_too_large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function outputText(result) {
  if (typeof result?.output_text === "string" && result.output_text.trim()) return result.output_text.trim();
  return (Array.isArray(result?.output) ? result.output : []).flatMap(item => item?.content || [])
    .filter(item => item?.type === "output_text").map(item => item.text).join("\n").trim();
}

function compact(value, limit = 1600) {
  if (value == null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function mcpTrace(result) {
  return (Array.isArray(result?.output) ? result.output : [])
    .filter(item => String(item?.type || "").includes("mcp"))
    .map(item => ({
      type: item.type || null,
      server: item.server_label || item.server || "activepieces",
      tool: item.name || item.tool_name || null,
      status: item.status || null,
      arguments: compact(item.arguments ?? item.input),
      output: compact(item.output ?? item.result),
      error: compact(item.error)
    }));
}

function idsFrom(text) {
  const value = String(text || "");
  const find = label => value.match(new RegExp(`${label}\\s*[:：#-]?\\s*([A-Za-z0-9_-]{8,})`, "i"))?.[1] || null;
  return { flow_id: find("Flow\\s*ID"), run_id: find("Run\\s*ID") };
}

function writeExperiment(entry) {
  const safe = {
    schema: "SiyadahExperimentV1",
    id: entry.id || randomUUID(),
    recorded_at: new Date().toISOString(),
    ...entry
  };
  appendFileSync(experimentLedgerPath, `${JSON.stringify(safe)}\n`, { encoding: "utf8" });
  return safe;
}

function readExperiments(limit = 50) {
  const lines = readFileSync(experimentLedgerPath, "utf8").split("\n").filter(Boolean);
  return lines.slice(-Math.max(1, Math.min(limit, 200))).reverse().flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

async function chat(input) {
  const startedAt = Date.now();
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const apToken = typeof input.activepieces_token === "string" ? input.activepieces_token.trim() : "";
  if (!message) throw Object.assign(new Error("message_required"), { statusCode: 422 });
  if (!apToken) throw Object.assign(new Error("activepieces_not_connected"), { statusCode: 409 });
  const conversationId = typeof input.conversation_id === "string" && input.conversation_id ? input.conversation_id : randomUUID();
  const history = conversations.get(conversationId) || [];
  const instructions = [
    "أنت شات سيادة بقدرات Activepieces MCP الكاملة في المشروع الذي فوّضه المستخدم لهذه الجلسة.",
    "حوّل الهدف مباشرة إلى أدوات MCP. لا تعرض proposal أو plan أو approval ولا تستخدم work polling قبل إنشاء أو تعديل مسودة Flow معطلة.",
    "اختر الأدوات من الكتالوج الحي بنفسك إن لم يسمها المستخدم. افحص schema فقط عند الحاجة، وابن المسودة ثم اقرأ البنية والإعدادات الفعلية وأصلح النقص داخل نفس Flow.",
    "لا تدّع اختبارًا كاملًا إلا إذا أثبت ap_test_flow ثم ap_get_run نجاح نفس Run ومخرجات خطوات غير فارغة.",
    "لا تنشر أو تفعّل أو تحذف ولا تنفذ أثرًا خارجيًا إلا بطلب صريح في الرسالة الحالية.",
    "أعد Flow ID وRun ID والأدلة الحقيقية فقط."
  ].join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${openAiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model, store: false, instructions,
        input: [...history.slice(-12), { role: "user", content: message }],
        tools: [{ type: "mcp", server_label: "activepieces", server_url: "https://cloud.activepieces.com/mcp", authorization: apToken, require_approval: "never" }]
      }),
      signal: controller.signal
    });
    if (!response.ok) throw Object.assign(new Error(`openai_${response.status}`), { statusCode: 502 });
    const result = await response.json();
    const reply = outputText(result);
    if (!reply) throw Object.assign(new Error("openai_empty_response"), { statusCode: 502 });
    const refs = idsFrom(reply);
    const experiment = writeExperiment({
      origin: "codex_siyadah_server",
      request_id: input.request_id || null,
      conversation_id: conversationId,
      user_request: message,
      status: "completed",
      latency_ms: Date.now() - startedAt,
      model,
      transport: "openai_responses_to_activepieces_mcp",
      tool_trace: mcpTrace(result),
      usage: result.usage || null,
      evidence: { ...refs, reply: compact(reply, 4000) }
    });
    conversations.set(conversationId, [...history, { role: "user", content: message }, { role: "assistant", content: reply }].slice(-12));
    return { ok: true, request_id: input.request_id, request_status: "observed", conversation_id: conversationId, reply,
      experiment_id: experiment.id,
      execution: { system: "openai_activepieces_mcp", surface: "isolated_lab", status: "completed" } };
  } catch (error) {
    writeExperiment({
      origin: "codex_siyadah_server",
      request_id: input.request_id || null,
      conversation_id: conversationId,
      user_request: message,
      status: "failed",
      latency_ms: Date.now() - startedAt,
      model,
      transport: "openai_responses_to_activepieces_mcp",
      error: { code: error?.name === "AbortError" ? "openai_timeout" : String(error?.message || "unknown_error") }
    });
    throw error;
  } finally { clearTimeout(timer); }
}

async function relayMcp(request, response) {
  const payload = await body(request);
  const headers = { authorization: String(request.headers.authorization || ""), accept: "application/json, text/event-stream", "content-type": "application/json" };
  for (const key of ["mcp-protocol-version", "mcp-session-id"]) if (request.headers[key]) headers[key] = request.headers[key];
  const upstream = await fetch("https://cloud.activepieces.com/mcp", { method: "POST", headers, body: JSON.stringify(payload) });
  const outgoing = { "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "no-store" };
  const sessionId = upstream.headers.get("mcp-session-id");
  if (sessionId) outgoing["mcp-session-id"] = sessionId;
  response.writeHead(upstream.status, outgoing);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

function serve(request, response, pathname) {
  const wanted = pathname === "/" ? "/app/chat.html" : pathname;
  const resolved = normalize(join(root, wanted));
  if (!resolved.startsWith(root + "/")) return json(response, 404, { error: "not_found" });
  try {
    if (!statSync(resolved).isFile()) throw new Error("not_file");
    response.writeHead(200, { "content-type": mime[extname(resolved)] || "application/octet-stream", "cache-control": "no-cache" });
    createReadStream(resolved).pipe(response);
  } catch { json(response, 404, { error: "not_found" }); }
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://lab.local");
  try {
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { status: "ok", service: "siyadah-direct-mcp-lab" });
    if (request.method === "GET" && url.pathname.startsWith("/lab/enter/")) {
      const supplied = decodeURIComponent(url.pathname.slice("/lab/enter/".length));
      if (!equal(supplied, labToken)) return json(response, 404, { error: "not_found" });
      response.writeHead(303, { location: "/app/chat.html", "set-cookie": `siy_lab=${encodeURIComponent(labToken)}; HttpOnly; Secure; SameSite=Strict; Path=/`, "cache-control": "no-store" });
      return response.end();
    }
    if (!authorized(request)) return json(response, 404, { error: "not_found" });
    if (request.method === "GET" && url.pathname === "/siyadah-api/v1/experiments") {
      const limit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
      return json(response, 200, { ok: true, experiments: readExperiments(Number.isFinite(limit) ? limit : 50) });
    }
    if (request.method === "POST" && url.pathname === "/activepieces-mcp") return await relayMcp(request, response);
    if (request.method === "POST" && url.pathname === "/siyadah-api/v1/chat") {
      const input = await body(request);
      if (input.op === "hydrate") return json(response, 200, { ok: true, company: "مختبر MCP المباشر", brain: null, memory: [], team: [], recent_work: [], conversations: [] });
      if (input.op !== "message") return json(response, 422, { ok: false, error: { code: "unsupported_operation" } });
      return json(response, 200, await chat(input));
    }
    if (request.method === "GET") return serve(request, response, url.pathname);
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const timeout = error?.name === "AbortError";
    json(response, timeout ? 504 : (error.statusCode || 500), { ok: false, error: { code: timeout ? "openai_timeout" : error.message } });
  }
}).listen(port, "0.0.0.0", () => console.log(JSON.stringify({ event: "lab_started", port })));
