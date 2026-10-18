import type { NextRequest } from "next/server";

export const CONNECT_OK_COOKIE = "pinterest_connect_ok";

function connectGateSecret(): string | null {
  const token = process.env.CONNECT_PAGE_TOKEN?.trim();
  return token && token.length >= 16 ? token : null;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isConnectGateEnabled(): boolean {
  return connectGateSecret() !== null;
}

/** Pinterest OAuth callback must stay reachable without the gate query param. */
export function isPinterestOAuthCallback(request: NextRequest): boolean {
  if (request.nextUrl.pathname !== "/api/oauth/pinterest") {
    return false;
  }
  return request.nextUrl.searchParams.has("code");
}

export function connectGateAuthorized(request: NextRequest): boolean {
  const secret = connectGateSecret();
  if (!secret) {
    return true;
  }

  const queryToken = request.nextUrl.searchParams.get("connect_token");
  if (queryToken && timingSafeEqualString(queryToken, secret)) {
    return true;
  }

  const cookie = request.cookies.get(CONNECT_OK_COOKIE)?.value;
  if (cookie && timingSafeEqualString(cookie, secret)) {
    return true;
  }

  return false;
}

export function connectOkCookieValue(): string | null {
  return connectGateSecret();
}
