import { createServer } from "node:http";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { createChatFixture, users } from "./chat-fixture.mjs";
import { runLegacyHandler } from "../app/api/_adapter.js";

// Isolated test host. Real components and API handlers, disposable PostgreSQL,
// fixture identities, and no production credentials or external services.
const fixture = await createChatFixture();
const built = await build({
  stdin: {
    contents: `import React from "react";
      import { createRoot } from "react-dom/client";
      import Workspace from "./src/DirectMessagesWorkspace.jsx";
      const user = new URL(location.href).searchParams.get("user") || "adopter";
      const request = async (url, options = {}) => {
        const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: "Bearer fixture:" + user }, signal: AbortSignal.timeout(15000) });
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
        return data;
      };
      const userIds = ${JSON.stringify(Object.fromEntries(Object.entries(users).map(([key, value]) => [key, value.id])))};
      const workspace = <Workspace request={request} userId={userIds[user]} onBrowse={() => location.assign("/?user=" + user)} />;
      const embedded = new URL(location.href).searchParams.has("embedded");
      createRoot(document.getElementById("root")).render(embedded ? <div className="app map-app"><main className="map-workspace panel-messages"><aside className="map-rail"><div className="rail-content"><div className="map-message-tabs"><button>Listing chats</button><button>Application updates</button></div>{workspace}</div></aside></main></div> : workspace);`,
    resolveDir: process.cwd(), loader: "jsx", sourcefile: "chat-fixture-entry.jsx",
  },
  bundle: true, write: false, outdir: "chat-memory-bundle", format: "esm", splitting: true,
  define: { "process.env.NODE_ENV": '"production"' }, loader: { ".js": "jsx" }, logLevel: "silent",
});
const assets = new Map(built.outputFiles.map(file => [file.path.split(/[\\/]/).at(-1), file.contents]));
const entry = [...assets.keys()].find(name => name.endsWith(".js") && !name.startsWith("chunk-") && !name.startsWith("VideoCall-"));
const css = [...assets.keys()].filter(name => name.endsWith(".css"));
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const config = (await import("../next.config.mjs")).default;
const headers = (await config.headers())[0].headers;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:4317");
    for (const header of headers) response.setHeader(header.key, header.value);
    if (url.pathname.startsWith("/api/")) {
      const handler = fixture.handlers[url.pathname.slice(5)];
      if (!handler) { response.writeHead(404).end(); return; }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const nextRequest = new Request(url, { method: request.method, headers: request.headers, ...(!["GET", "HEAD"].includes(request.method) ? { body: Buffer.concat(chunks) } : {}) });
      const result = await runLegacyHandler(handler, nextRequest);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
      return;
    }
    if (url.pathname === "/base.css") { response.setHeader("Content-Type", "text/css; charset=utf-8"); response.end(styles + "\n:root { --font-dm-sans: Arial; --font-dm-serif: Georgia; }"); return; }
    const name = url.pathname.slice(1);
    if (assets.has(name)) { response.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : "text/javascript"); response.end(assets.get(name)); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><head><title>Pawline — Chat QA</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/base.css">${css.map(name => `<link rel="stylesheet" href="/${name}">`).join("")}<style>html,body,#root{height:100%;margin:0}#root{height:100dvh;max-width:1400px;margin:auto}</style></head><body><div id="root"></div><script type="module" src="/${entry}"></script></body></html>`);
  } catch (error) { console.error(error.message); response.writeHead(500).end("Fixture error"); }
});
server.listen(4317, "127.0.0.1", () => console.log("Chat fixture ready at http://127.0.0.1:4317"));
const stop = () => server.close(() => fixture.close().then(() => process.exit(0)));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
