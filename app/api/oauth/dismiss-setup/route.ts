import { NextResponse } from "next/server";
import { OAUTH_SETUP_COOKIE } from "@/src/pinterest/token-store";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OAUTH_SETUP_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
