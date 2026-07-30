class LegacyResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = new Headers();
    this.payload = null;
  }
  setHeader(name, value) {
    this.headers.set(name, String(value));
    return this;
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  json(value) {
    this.headers.set("Content-Type", "application/json; charset=utf-8");
    this.payload = JSON.stringify(value);
    return this;
  }
  send(value) {
    this.payload = value;
    return this;
  }
  end() {
    this.payload = null;
    return this;
  }
  toResponse() {
    return new Response(this.payload, { status: this.statusCode, headers: this.headers });
  }
}

export async function runLegacyHandler(handler, nextRequest) {
  const url = new URL(nextRequest.url);
  let body;
  if (!["GET", "HEAD"].includes(nextRequest.method)) {
    const contentType = nextRequest.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await nextRequest.json().catch(() => ({}));
    }
  }
  const headers = Object.fromEntries(nextRequest.headers.entries());
  const request = {
    method: nextRequest.method,
    headers,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
    socket: { remoteAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown" },
  };
  const response = new LegacyResponse();
  await handler(request, response);
  return response.toResponse();
}
