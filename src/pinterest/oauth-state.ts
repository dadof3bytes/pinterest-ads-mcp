import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/src/config/env";

function sign(payload: string): string {
  const secret = requireEnv("OAUTH_STATE_SECRET");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOAuthState(sandbox: boolean): string {
  const nonce = randomUUID();
  const payload = `${nonce}.${sandbox ? "1" : "0"}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string): { sandbox: boolean } {
  const parts = state.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid OAuth state");
  }
  const [nonce, sandboxFlag, sig] = parts;
  const payload = `${nonce}.${sandboxFlag}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid OAuth state signature");
  }
  return { sandbox: sandboxFlag === "1" };
}

export function pinterestAuthorizeUrl(sandbox: boolean): string {
  const appId = requireEnv("PINTEREST_APP_ID");
  const redirectUri = requireEnv("PINTEREST_REDIRECT_URI");
  const scopes = [
    "user_accounts:read",
    "ads:read",
    "ads:write",
    "pins:read",
    "pins:write",
    "boards:read",
    "boards:write",
    "catalogs:read",
    "catalogs:write",
  ].join(",");
  const state = createOAuthState(sandbox);
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
  });
  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}
