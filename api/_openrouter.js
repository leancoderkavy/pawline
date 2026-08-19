const TASKS = {
  application_coach: {
    modelEnv: "OPENROUTER_APPLICATION_COACH_MODEL",
    promptVersion: "application-coach-v1",
    schemaVersion: "application-coach-output-v1",
    maxOutputTokens: 700,
  },
  intake_summarizer: {
    modelEnv: "OPENROUTER_INTAKE_SUMMARIZER_MODEL",
    promptVersion: "intake-summarizer-v2",
    schemaVersion: "intake-summarizer-output-v2",
    maxOutputTokens: 900,
  },
};

export async function reserveOpenRouterTask(database, { task, subject, organizationId = null }) {
  const { consumeUsageChain } = await import("./_usage-limit.js");
  if (!TASKS[task] || !database || !subject) throw failure("AI assistance is unavailable. Continue manually.");
  return consumeUsageChain(database, [
    { scope: `openrouter_${task}_subject_hour`, subject: String(subject), limit: 12, windowMs: 60 * 60 * 1000 },
    ...(organizationId ? [{ scope: `openrouter_${task}_organization_hour`, subject: String(organizationId), limit: 30, windowMs: 60 * 60 * 1000 }] : []),
    { scope: `openrouter_${task}_global_hour`, subject: "all", limit: 300, windowMs: 60 * 60 * 1000 },
  ]);
}

function values(value) {
  return [...new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean))];
}

function failure(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function configuredTask(task, environment) {
  const definition = TASKS[task];
  if (!definition) throw failure("This AI task is not approved.", 400);
  if (environment.OPENROUTER_ENABLED !== "true") {
    throw failure("AI assistance is unavailable. Continue manually.");
  }
  if (!environment.OPENROUTER_API_KEY) throw failure("AI assistance is unavailable. Continue manually.");
  // Private adoption tasks must carry both requirements; permissive defaults are unsafe.
  if (environment.OPENROUTER_ZDR !== "true" || environment.OPENROUTER_DATA_COLLECTION !== "deny") {
    throw failure("AI assistance is unavailable until private-data routing is configured.");
  }
  const model = String(environment[definition.modelEnv] || "").trim();
  const allowedModels = values(environment.OPENROUTER_ALLOWED_MODELS);
  const providers = values(environment.OPENROUTER_ALLOWED_PROVIDERS);
  if (!model || model === "openrouter/auto" || !allowedModels.includes(model) || !providers.length) {
    throw failure("AI assistance is unavailable until its approved route is configured.");
  }
  return { definition, model, providers };
}

export function getOpenRouterTaskStatus(environment = process.env) {
  const enabled = environment.OPENROUTER_ENABLED === "true";
  const privateRouting = environment.OPENROUTER_ZDR === "true"
    && environment.OPENROUTER_DATA_COLLECTION === "deny";
  const allowedModels = values(environment.OPENROUTER_ALLOWED_MODELS);
  const allowedProviders = values(environment.OPENROUTER_ALLOWED_PROVIDERS);
  const taskStates = Object.fromEntries(Object.entries(TASKS).map(([task, definition]) => {
    const model = String(environment[definition.modelEnv] || "").trim();
    return [task, Boolean(enabled && privateRouting && environment.OPENROUTER_API_KEY
      && model && allowedModels.includes(model) && allowedProviders.length)];
  }));
  return {
    configured: Boolean(environment.OPENROUTER_API_KEY),
    enabled,
    privateRouting,
    taskStates,
  };
}

export function createOpenRouterRequest({ task, system, prompt, schema, maxOutputTokens, environment = process.env }) {
  const { definition, model, providers } = configuredTask(task, environment);
  if (!schema || typeof schema !== "object") throw failure("AI output schema is required.", 500);
  const requestedTokens = Number(maxOutputTokens || definition.maxOutputTokens);
  const outputTokens = Number.isFinite(requestedTokens)
    ? Math.max(64, Math.min(Math.trunc(requestedTokens), definition.maxOutputTokens))
    : definition.maxOutputTokens;
  return {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      Authorization: `Bearer ${environment.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": String(environment.PAWLINE_CANONICAL_ORIGIN || "https://www.pawlineadopt.com"),
      "X-OpenRouter-Title": "Pawline",
    },
    body: {
      model,
      messages: [
        { role: "system", content: String(system || "") },
        { role: "user", content: String(prompt || "") },
      ],
      temperature: 0,
      max_tokens: outputTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: `${task}_response`, strict: true, schema },
      },
      // OpenRouter provider routing: never broaden beyond the approved set.
      provider: {
        order: providers,
        only: providers,
        allow_fallbacks: false,
        require_parameters: true,
        data_collection: "deny",
        zdr: true,
      },
    },
    metadata: {
      task,
      model,
      configuredProviderAllowlist: providers,
      promptVersion: definition.promptVersion,
      schemaVersion: definition.schemaVersion,
    },
  };
}

// This deliberately accepts a mockable transport. The live guard avoids a
// deployment or test accidentally spending provider credit while this release
// is feature-flagged. A future activation must use the exact request contract.
export async function generateOpenRouterObject({
  task, system, prompt, schema, validate, maxOutputTokens, requestId, environment = process.env, fetchImpl,
}) {
  const request = createOpenRouterRequest({ task, system, prompt, schema, maxOutputTokens, environment });
  if (environment.OPENROUTER_LIVE_CALLS_ENABLED !== "true" && !fetchImpl) {
    throw failure("AI assistance is unavailable. Continue manually.");
  }
  const transport = fetchImpl || fetch;
  const startedAt = Date.now();
  let response;
  try {
    response = await transport(request.endpoint, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw failure("AI assistance is temporarily unavailable. Continue manually.", 502);
  }
  if (!response.ok) throw failure("AI assistance is temporarily unavailable. Continue manually.", 502);
  const payload = await response.json().catch(() => null);
  const raw = payload?.choices?.[0]?.message?.content;
  if (!payload || !Array.isArray(payload.choices) || !payload.choices[0]?.message ||
    (typeof raw !== "string" && (!raw || typeof raw !== "object"))) {
    throw failure("AI assistance returned an invalid suggestion. Continue manually.", 502);
  }
  let output;
  try { output = typeof raw === "string" ? JSON.parse(raw) : raw; } catch {
    throw failure("AI assistance returned an invalid suggestion. Continue manually.", 502);
  }
  const validated = typeof validate === "function" ? validate(output) : output;
  if (!validated) throw failure("AI assistance returned an invalid suggestion. Continue manually.", 502);
  return {
    output: validated,
    metadata: {
      ...request.metadata,
      requestId: String(requestId || "").slice(0, 160) || null,
      provider: cleanProvider(payload?.provider || payload?.provider_name || payload?.metadata?.provider),
      latencyMs: Date.now() - startedAt,
      inputTokens: Number(payload?.usage?.prompt_tokens || 0) || null,
      outputTokens: Number(payload?.usage?.completion_tokens || 0) || null,
    },
  };
}

function cleanProvider(value) {
  return typeof value === "string" && /^[a-z0-9._-]{1,120}$/i.test(value) ? value : null;
}

export { TASKS };
