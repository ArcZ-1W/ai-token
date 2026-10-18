const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key, anthropic-version, anthropic-beta",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };

type ApiAccount = {
  id: string;
  username: string;
  is_admin: boolean;
  plan: string;
  models: string[];
  limit_auto: number;
  used_auto: number;
  limit_other: number;
  used_other: number;
  expires_at: string | null;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function message(status: number, text: string, type = "invalid_request_error"): Response {
  return json(status, { error: { message: text, type } });
}

function responseHeaders(source: Headers): Headers {
  const headers = new Headers(corsHeaders);
  for (const name of ["content-type", "cache-control", "retry-after"]) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function getBearer(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : request.headers.get("x-api-key");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!projectUrl || !serviceKey) throw new Error("Supabase service environment is not configured.");

  const response = await fetch(`${projectUrl.replace(/\/+$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) as T : null as T;
}

async function authenticate(request: Request): Promise<ApiAccount | Response> {
  const key = getBearer(request);
  if (!key || !/^xz_live_[A-Za-z0-9_-]{32,}$/.test(key)) {
    return message(401, "Missing or invalid Xozen API key.", "authentication_error");
  }

  const account = await rpc<ApiAccount | null>("app_api_key_auth", { p_key_hash: await sha256(key) });
  if (!account) return message(401, "API key is invalid, revoked, or the account is inactive.", "authentication_error");
  return account;
}

function isResponse(value: ApiAccount | Response): value is Response {
  return value instanceof Response;
}

function quota(account: ApiAccount) {
  const autoRemaining = Math.max(0, account.limit_auto - account.used_auto);
  const otherRemaining = Math.max(0, account.limit_other - account.used_other);
  return {
    object: "quota",
    username: account.username,
    plan: account.plan,
    remaining: autoRemaining + otherRemaining,
    total: account.limit_auto + account.limit_other,
    used: account.used_auto + account.used_other,
    auto: { remaining: autoRemaining, total: account.limit_auto, used: account.used_auto },
    other: { remaining: otherRemaining, total: account.limit_other, used: account.used_other },
    expires_at: account.expires_at,
  };
}

function models(account: ApiAccount) {
  const ids = Array.from(new Set(["auto", ...account.models]));
  return {
    object: "list",
    data: ids.map((id) => ({ id, object: "model", created: 0, owned_by: "xozen" })),
  };
}

async function handleChat(request: Request, account: ApiAccount, anthropic = false): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 15 * 1024 * 1024) return message(413, "Request body exceeds the 15 MB limit.");

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 15 * 1024 * 1024) return message(413, "Request body exceeds the 15 MB limit.");
    input = JSON.parse(raw);
  } catch {
    return message(400, "Request body must be valid JSON.");
  }
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    return message(400, "The messages field must be a non-empty array.");
  }
  const requestedModel = typeof input.model === "string" ? input.model : "";
  const model = requestedModel.startsWith("xozen/") ? requestedModel.slice("xozen/".length) : requestedModel;
  if (!model || (model !== "auto" && !account.models.includes(model))) {
    return message(403, "This model is not included in your Xozen account plan.", "permission_error");
  }
  input.model = model;

  const upstreamUrl = Deno.env.get("XOZEN_UPSTREAM_BASE_URL")?.replace(/\/+$/, "");
  const upstreamKey = Deno.env.get("XOZEN_UPSTREAM_API_KEY");
  if (!upstreamUrl || !upstreamKey) {
    return message(503, "Xozen API provider is not configured.", "server_error");
  }

  const kind = model === "auto" ? "auto" : "other";
  let reserved = false;
  if (!account.is_admin) {
    const reservation = await rpc<{ reserved: boolean } | null>("app_api_usage_reserve", {
      key_id: account.id,
      kind,
    });
    if (!reservation?.reserved) {
      return message(429, "Your Xozen account quota is exhausted or inactive.", "rate_limit_error");
    }
    reserved = true;
  }

  const upstreamBase = anthropic ? upstreamUrl.replace(/\/v1$/i, "") + "/v1" : upstreamUrl;
  const upstreamPath = anthropic ? "/messages" : "/chat/completions";
  const upstreamHeaders: Record<string, string> = anthropic
    ? {
      "content-type": "application/json",
      "x-api-key": upstreamKey,
      "anthropic-version": request.headers.get("anthropic-version") || "2023-06-01",
    }
    : {
      authorization: `Bearer ${upstreamKey}`,
      "content-type": "application/json",
    };
  if (anthropic) {
    const beta = request.headers.get("anthropic-beta");
    if (beta) upstreamHeaders["anthropic-beta"] = beta;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase}${upstreamPath}`, {
      method: "POST",
      signal: request.signal,
      headers: upstreamHeaders,
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (reserved) await rpc("app_api_usage_refund", { key_id: account.id, kind });
    console.error("Xozen upstream request failed.", error);
    return message(502, "Unable to reach the Xozen model provider.", "server_error");
  }

  if (!upstream.ok) {
    if (reserved) await rpc("app_api_usage_refund", { key_id: account.id, kind });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders(upstream.headers),
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders(upstream.headers),
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  const versionIndex = pathname.lastIndexOf("/v1");
  const route = versionIndex >= 0 ? pathname.slice(versionIndex + 3) || "/" : pathname;
  if (route !== "/models" && route !== "/quota" && route !== "/chat/completions" && route !== "/messages") {
    return message(404, "Endpoint not found.", "invalid_request_error");
  }
  if ((route === "/models" || route === "/quota") && request.method !== "GET") {
    return message(405, "Method not allowed.");
  }
  if (route === "/chat/completions" && request.method !== "POST") {
    return message(405, "Method not allowed.");
  }
  if (route === "/messages" && request.method !== "POST") {
    return message(405, "Method not allowed.");
  }

  try {
    const account = await authenticate(request);
    if (isResponse(account)) return account;
    if (route === "/models") return json(200, models(account));
    if (route === "/quota") return json(200, quota(account));
    return await handleChat(request, account, route === "/messages");
  } catch (error) {
    console.error("Xozen API request failed.", error);
    return message(500, "Xozen API could not process the request.", "server_error");
  }
});
