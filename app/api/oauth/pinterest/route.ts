import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/src/pinterest/client";
import { verifyOAuthState } from "@/src/pinterest/oauth-state";
import { OAUTH_SETUP_COOKIE } from "@/src/pinterest/token-store";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/connect?error=${encodeURIComponent(oauthError)}`, url.origin),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/connect?error=missing_code_or_state", url.origin),
    );
  }

  try {
    const { sandbox } = verifyOAuthState(state);
    const { scopes, tokenSave } = await exchangeAuthorizationCode(code, sandbox);
    const redirect = new URL("/connect", url.origin);
    redirect.searchParams.set("connected", "1");
    redirect.searchParams.set("scope_count", String(scopes.length));
    if (tokenSave.storage === "environment") {
      redirect.searchParams.set("vercel_setup", "1");
    }
    const response = NextResponse.redirect(redirect);
    if (tokenSave.storage === "environment") {
      response.cookies.set(OAUTH_SETUP_COOKIE, tokenSave.encrypted_for_env, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 15,
        path: "/",
      });
    }
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/connect?error=${encodeURIComponent(message)}`, url.origin),
    );
  }
}
