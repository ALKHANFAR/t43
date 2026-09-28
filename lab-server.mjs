import { createServer } from "node:http";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";

const root = process.cwd();
const port = Number.parseInt(process.env.PORT || "3000", 10);
const llmKey = String(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "").trim();
const labToken = String(process.env.LAB_ACCESS_TOKEN || "").trim();
const model = String(process.env.LLM_MODEL || process.env.OPENAI_MODEL || "deepseek-flash").trim();
const llmResponsesUrl = String(process.env.LLM_RESPONSES_URL || "https://api.deepseek.com/responses").trim();
const activepiecesUrl = String(process.env.ACTIVEPIECES_URL || "https://cloud.activepieces.com").trim().replace(/\/+$/, "");
const activepiecesMcpUrl = String(process.env.ACTIVEPIECES_MCP_URL ||
  (process.env.ACTIVEPIECES_URL ? `${activepiecesUrl}/mcp` : "https://cloud.activepieces.com/mcp")).trim();
const conversations = new Map();
const experimentLedgerPath = String(process.env.EXPERIMENT_LEDGER_PATH || join(root, "data", "experiments.jsonl"));

if (!labToken) throw new Error("LAB_ACCESS_TOKEN is required");

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

function parseMcpSse(text, id) {
  const messages = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim()).join("\n");
    if (data) try { messages.push(JSON.parse(data)); } catch {}
  }
  return messages.find(message => message?.id === id) || messages[0] || null;
}

async function mcpRpc(state, token, method, params) {
  const notification = method.startsWith("notifications/");
  const id = notification ? null : ++state.requestId;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json"
  };
  if (method !== "initialize") headers["mcp-protocol-version"] = state.protocolVersion;
  if (state.sessionId) headers["mcp-session-id"] = state.sessionId;
  const payload = { jsonrpc: "2.0", method };
  if (!notification) payload.id = id;
  if (params !== undefined) payload.params = params;
  const response = await fetch(activepiecesMcpUrl, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!response.ok) throw Object.assign(new Error(`activepieces_mcp_${response.status}`), { statusCode: 502 });
  state.sessionId = response.headers.get("mcp-session-id") || state.sessionId;
  if (response.status === 202 || response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const message = (response.headers.get("content-type") || "").includes("text/event-stream")
    ? parseMcpSse(text, id) : JSON.parse(text);
  if (message?.error) throw Object.assign(new Error(message.error.message || "activepieces_mcp_error"), { statusCode: 502 });
  return message?.result ?? message;
}

async function openMcp(token) {
  const state = { requestId: 0, sessionId: null, protocolVersion: "2025-11-25" };
  const initialized = await mcpRpc(state, token, "initialize", {
    protocolVersion: state.protocolVersion,
    capabilities: {},
    clientInfo: { name: "siyadah-deepseek", version: "1.0.0" }
  });
  if (initialized?.protocolVersion) state.protocolVersion = initialized.protocolVersion;
  await mcpRpc(state, token, "notifications/initialized", {});
  const tools = [];
  let cursor = null;
  do {
    const result = await mcpRpc(state, token, "tools/list", cursor ? { cursor } : {});
    if (!Array.isArray(result?.tools)) throw Object.assign(new Error("activepieces_tools_unavailable"), { statusCode: 502 });
    tools.push(...result.tools);
    cursor = result.nextCursor || null;
  } while (cursor);
  return { state, tools };
}

function llmTools(tools) {
  return tools.filter(tool => /^[A-Za-z0-9_-]{1,128}$/.test(String(tool?.name || ""))).map(tool => ({
    type: "function",
    name: tool.name,
    description: String(tool.description || "Activepieces tool").slice(0, 1200),
    parameters: tool.inputSchema || { type: "object", properties: {} }
  }));
}

function compact(value, limit = 1600) {
  if (value == null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
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
  if (!llmKey) throw Object.assign(new Error("deepseek_not_configured"), { statusCode: 503 });
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
  let result;
  const toolTrace = [];
  try {
    const mcp = await openMcp(apToken);
    const tools = llmTools(mcp.tools);
    if (!tools.length) throw Object.assign(new Error("activepieces_tools_unavailable"), { statusCode: 502 });
    const modelInput = [...history.slice(-12), { role: "user", content: message }];
    for (let round = 0; round < 8; round += 1) {
      const response = await fetch(llmResponsesUrl, {
        method: "POST",
        headers: { authorization: `Bearer ${llmKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, instructions, input: modelInput, tools, tool_choice: "auto", reasoning: { effort: "none" } }),
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = compact(await response.text(), 500);
        throw Object.assign(new Error(`llm_${response.status}${detail ? `: ${detail}` : ""}`), { statusCode: 502 });
      }
      result = await response.json();
      const calls = (Array.isArray(result?.output) ? result.output : []).filter(item => item?.type === "function_call");
      if (!calls.length) break;
      for (const call of calls) {
        let args;
        try { args = JSON.parse(call.arguments || "{}"); } catch { throw Object.assign(new Error("llm_invalid_tool_arguments"), { statusCode: 502 }); }
        const toolResult = await mcpRpc(mcp.state, apToken, "tools/call", { name: call.name, arguments: args });
        toolTrace.push({ type: "function_call", server: "activepieces", tool: call.name, status: "completed", arguments: compact(args), output: compact(toolResult) });
        modelInput.push({ type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments || "{}" });
        modelInput.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(toolResult) });
      }
    }
    const reply = outputText(result);
    if (!reply) throw Object.assign(new Error("llm_empty_response"), { statusCode: 502 });
    const refs = idsFrom(reply);
    const experiment = writeExperiment({
      origin: "codex_siyadah_server",
      request_id: input.request_id || null,
      conversation_id: conversationId,
      user_request: message,
      status: "completed",
      latency_ms: Date.now() - startedAt,
      model,
      transport: "deepseek_responses_to_activepieces_mcp",
      tool_trace: toolTrace,
      usage: result.usage || null,
      evidence: { ...refs, reply: compact(reply, 4000) }
    });
    conversations.set(conversationId, [...history, { role: "user", content: message }, { role: "assistant", content: reply }].slice(-12));
    return { ok: true, request_id: input.request_id, request_status: "observed", conversation_id: conversationId, reply,
      experiment_id: experiment.id,
      execution: { system: "deepseek_activepieces_mcp", surface: "isolated_lab", status: "completed" } };
  } catch (error) {
    writeExperiment({
      origin: "codex_siyadah_server",
      request_id: input.request_id || null,
      conversation_id: conversationId,
      user_request: message,
      status: "failed",
      latency_ms: Date.now() - startedAt,
      model,
      transport: "deepseek_responses_to_activepieces_mcp",
      error: { code: error?.name === "AbortError" ? "llm_timeout" : String(error?.message || "unknown_error") }
    });
    throw error;
  } finally { clearTimeout(timer); }
}

async function relayMcp(request, response) {
  const payload = await body(request);
  const headers = { authorization: String(request.headers.authorization || ""), accept: "application/json, text/event-stream", "content-type": "application/json" };
  for (const key of ["mcp-protocol-version", "mcp-session-id"]) if (request.headers[key]) headers[key] = request.headers[key];
  const upstream = await fetch(activepiecesMcpUrl, { method: "POST", headers, body: JSON.stringify(payload) });
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
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, {
      status: "ok", service: "siyadah-direct-mcp-lab", llm_configured: Boolean(llmKey),
      llm_model: model, activepieces_url: activepiecesUrl
    });
    if (request.method === "GET" && url.pathname === "/app/runtime-config.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      return response.end(`window.SIYADAH_ACTIVEPIECES_URL=${JSON.stringify(activepiecesUrl)};`);
    }
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
