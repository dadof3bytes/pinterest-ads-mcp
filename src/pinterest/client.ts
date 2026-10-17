import { getEnv, requireEnv } from "@/src/config/env";
import { majorToMicro, microToMajor } from "@/src/pinterest/microcurrency";
import {
  assertBatchWriteSucceeded,
  formatPinterestErrorBody,
} from "@/src/pinterest/batch-writes";
import {
  getRefreshToken,
  saveRefreshToken,
  type SaveRefreshTokenResult,
} from "@/src/pinterest/token-store";

export class PinterestApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "PinterestApiError";
  }
}

const MONEY_FIELDS = [
  "daily_spend_cap",
  "lifetime_spend_cap",
  "budget_in_micro_currency",
  "bid_in_micro_currency",
  "spend_in_micro_dollar",
];

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  /** Retry once on 429 for safe reads */
  allowReadRetry?: boolean;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/** Pinterest requires client_id:client_secret via HTTP Basic Auth on /oauth/token. */
function pinterestBasicAuthHeader(appId: string, appSecret: string): string {
  const encoded = Buffer.from(`${appId}:${appSecret}`, "utf8").toString("base64");
  return `Basic ${encoded}`;
}

function formatPinterestOAuthError(json: Record<string, unknown>): string {
  const message =
    typeof json.message === "string"
      ? json.message
      : typeof json.error_description === "string"
        ? json.error_description
        : typeof json.error === "string"
          ? json.error
          : null;
  if (message) {
    return `OAuth token exchange failed: ${message}`;
  }
  return `OAuth token exchange failed (${JSON.stringify(json)})`;
}

function isSandboxMode(): boolean {
  const env = getEnv();
  if (env.PINTEREST_USE_SANDBOX) return true;
  return false;
}

export function apiBaseUrl(): string {
  return isSandboxMode()
    ? "https://api-sandbox.pinterest.com/v5"
    : "https://api.pinterest.com/v5";
}

function tokenBaseUrl(): string {
  return isSandboxMode()
    ? "https://api-sandbox.pinterest.com/v5"
    : "https://api.pinterest.com/v5";
}

export function defaultAdAccountId(): string {
  return requireEnv("PINTEREST_AD_ACCOUNT_ID");
}

export function resolveAdAccountId(override?: string): string {
  return override ?? defaultAdAccountId();
}

async function exchangeRefreshToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}> {
  const appId = requireEnv("PINTEREST_APP_ID");
  const appSecret = requireEnv("PINTEREST_APP_SECRET");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`${tokenBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: pinterestBasicAuthHeader(appId, appSecret),
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new PinterestApiError(
      `Token refresh failed: ${JSON.stringify(json)}`,
      res.status,
      json,
    );
  }
  if (typeof json.refresh_token === "string") {
    const scopes =
      typeof json.scope === "string"
        ? json.scope.split(",").map((s) => s.trim())
        : [];
    await saveRefreshToken(json.refresh_token, scopes, isSandboxMode());
  }
  return json as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
  };
}

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }
  const refresh = await getRefreshToken();
  if (!refresh) {
    throw new PinterestApiError(
      "No Pinterest refresh token. Visit /connect to authorize.",
      401,
    );
  }
  const tokens = await exchangeRefreshToken(refresh);
  cachedAccessToken = {
    token: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  return tokens.access_token;
}

export async function exchangeAuthorizationCode(
  code: string,
  sandboxFromState: boolean,
): Promise<{ scopes: string[]; tokenSave: SaveRefreshTokenResult }> {
  const appId = requireEnv("PINTEREST_APP_ID");
  const appSecret = requireEnv("PINTEREST_APP_SECRET");
  const redirectUri = requireEnv("PINTEREST_REDIRECT_URI");
  const base = sandboxFromState
    ? "https://api-sandbox.pinterest.com/v5"
    : "https://api.pinterest.com/v5";
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  if (getEnv().PINTEREST_CONTINUOUS_REFRESH === true) {
    body.set("continuous_refresh", "true");
  }
  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: pinterestBasicAuthHeader(appId, appSecret),
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new PinterestApiError(formatPinterestOAuthError(json), res.status, json);
  }
  const refreshToken = json.refresh_token;
  if (typeof refreshToken !== "string") {
    throw new PinterestApiError("OAuth response missing refresh_token", 500, json);
  }
  const scopes =
    typeof json.scope === "string"
      ? json.scope.split(",").map((s) => s.trim())
      : [];
  const tokenSave = await saveRefreshToken(refreshToken, scopes, sandboxFromState);
  cachedAccessToken = null;
  return { scopes, tokenSave };
}

function buildQuery(
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function convertResponseMoney(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(convertResponseMoney);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (MONEY_FIELDS.includes(k) && typeof v === "number") {
        out[k] = microToMajor(v);
        out[`${k}_micro`] = v;
      } else if (k === "items" && Array.isArray(v)) {
        out[k] = v.map(convertResponseMoney);
      } else {
        out[k] = convertResponseMoney(v);
      }
    }
    return out;
  }
  return data;
}

export function prepareWriteBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  for (const field of MONEY_FIELDS) {
    if (typeof out[field] === "number" && !field.includes("micro")) {
      out[field] = majorToMicro(out[field] as number);
    }
  }
  if (typeof out.daily_spend_cap_major === "number") {
    out.daily_spend_cap = majorToMicro(out.daily_spend_cap_major as number);
    delete out.daily_spend_cap_major;
  }
  if (typeof out.lifetime_spend_cap_major === "number") {
    out.lifetime_spend_cap = majorToMicro(out.lifetime_spend_cap_major as number);
    delete out.lifetime_spend_cap_major;
  }
  if (typeof out.bid_in_micro_currency_major === "number") {
    out.bid_in_micro_currency = majorToMicro(
      out.bid_in_micro_currency_major as number,
    );
    delete out.bid_in_micro_currency_major;
  }
  return out;
}

export async function pinterestRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const isRead = method === "GET";
  const url = `${apiBaseUrl()}${path}${buildQuery(options.query)}`;

  const doFetch = async (retry429: boolean): Promise<Response> => {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.idempotencyKey) {
      headers["X-Pinterest-Idempotency-Key"] = options.idempotencyKey;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 401) {
      cachedAccessToken = null;
      const token2 = await getAccessToken();
      headers.Authorization = `Bearer ${token2}`;
      return fetch(url, {
        method,
        headers,
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    }
    if (retry429 && res.status === 429 && isRead && options.allowReadRetry !== false) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "1");
      await new Promise((r) => setTimeout(r, Math.min(retryAfter, 5) * 1000));
      return doFetch(false);
    }
    return res;
  };

  const res = await doFetch(true);
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { message: text };
    }
  }
  if (!res.ok) {
    const detail = formatPinterestErrorBody(json);
    throw new PinterestApiError(
      `Pinterest API ${method} ${path} failed (${res.status}): ${detail}`,
      res.status,
      json,
    );
  }
  json = convertResponseMoney(json);
  return json as T;
}

export async function pinterestWriteRequest<T = unknown>(
  path: string,
  options: Omit<RequestOptions, "allowReadRetry"> & {
    method: "POST" | "PATCH";
    operationLabel: string;
  },
): Promise<T> {
  const result = await pinterestRequest<T>(path, {
    ...options,
    allowReadRetry: false,
  });
  assertBatchWriteSucceeded(result, options.operationLabel);
  return result;
}

export interface PaginatedResult<T> {
  items: T[];
  bookmark?: string | null;
  has_more: boolean;
}

export function paginateResponse<T>(data: {
  items?: T[];
  bookmark?: string | null;
}): PaginatedResult<T> {
  const items = data.items ?? [];
  return {
    items,
    bookmark: data.bookmark ?? null,
    has_more: Boolean(data.bookmark),
  };
}

export const DEFAULT_PAGE_SIZE = 25;
