import { NextResponse, type NextRequest } from "next/server";
import {
  CONNECT_OK_COOKIE,
  connectGateAuthorized,
  connectOkCookieValue,
  isConnectGateEnabled,
  isPinterestOAuthCallback,
} from "@/src/pinterest/connect-gate";

export function middleware(request: NextRequest) {
  if (!isConnectGateEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isConnectPage = pathname === "/connect";
  const isOAuthRoute = pathname === "/api/oauth/pinterest";

  if (!isConnectPage && !isOAuthRoute) {
    return NextResponse.next();
  }

  if (isPinterestOAuthCallback(request)) {
    return NextResponse.next();
  }

  if (connectGateAuthorized(request)) {
    const response = NextResponse.next();
    const queryToken = request.nextUrl.searchParams.get("connect_token");
    const cookieValue = connectOkCookieValue();
    if (isConnectPage && queryToken && cookieValue) {
      response.cookies.set(CONNECT_OK_COOKIE, cookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60,
        path: "/",
      });
    }
    return response;
  }

  if (isConnectPage) {
    return NextResponse.json(
      {
        error: "connect_forbidden",
        message:
          "Connect page is protected. Open /connect?connect_token=YOUR_CONNECT_PAGE_TOKEN (set CONNECT_PAGE_TOKEN in the server environment).",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ error: "connect_forbidden" }, { status: 401 });
}

export const config = {
  matcher: ["/connect", "/api/oauth/pinterest"],
};
