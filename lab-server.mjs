import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number.parseInt(process.env.PORT || "3000", 10);
const activepiecesUrl = String(
  process.env.ACTIVEPIECES_URL || "https://activepieces-production-82ad.up.railway.app",
).trim().replace(/\/+$/, "");
const activepiecesChatUrl = `${activepiecesUrl}/chat`;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function json(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function redirectToNativeChat(response) {
  response.writeHead(303, {
    location: activepiecesChatUrl,
    "cache-control": "no-store",
  });
  response.end();
}

function serve(response, pathname) {
  const resolved = normalize(join(root, pathname));
  if (!resolved.startsWith(`${root}/`)) return json(response, 404, { error: "not_found" });
  try {
    if (!statSync(resolved).isFile()) throw new Error("not_file");
    response.writeHead(200, {
      "content-type": mime[extname(resolved)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    createReadStream(resolved).pipe(response);
  } catch {
    json(response, 404, { error: "not_found" });
  }
}

createServer((request, response) => {
  const url = new URL(request.url || "/", "http://siyadah.local");

  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, {
      status: "ok",
      service: "siyadah-activepieces-direct-entry",
      architecture: "browser_redirect_to_activepieces_native_chat",
      activepieces_chat_url: activepiecesChatUrl,
      intermediary: false,
    });
  }

  if (
    request.method === "GET" &&
    ["/", "/app", "/app/", "/app/chat.html"].includes(url.pathname)
  ) {
    return redirectToNativeChat(response);
  }

  if (request.method === "GET") return serve(response, url.pathname);
  return json(response, 404, { error: "not_found" });
}).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "direct_entry_started", port, activepiecesChatUrl }));
});
