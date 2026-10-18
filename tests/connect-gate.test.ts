import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  connectGateAuthorized,
  isConnectGateEnabled,
} from "@/src/pinterest/connect-gate";

describe("connect gate", () => {
  const prior = process.env.CONNECT_PAGE_TOKEN;

  afterEach(() => {
    if (prior === undefined) {
      delete process.env.CONNECT_PAGE_TOKEN;
    } else {
      process.env.CONNECT_PAGE_TOKEN = prior;
    }
  });

  it("is disabled when CONNECT_PAGE_TOKEN is unset", () => {
    delete process.env.CONNECT_PAGE_TOKEN;
    expect(isConnectGateEnabled()).toBe(false);
  });

  it("allows access when query token matches", () => {
    process.env.CONNECT_PAGE_TOKEN = "super-secret-connect-gate";
    const req = new NextRequest(
      "http://localhost:3000/connect?connect_token=super-secret-connect-gate",
    );
    expect(connectGateAuthorized(req)).toBe(true);
  });

  it("denies access when gate is enabled and token missing", () => {
    process.env.CONNECT_PAGE_TOKEN = "super-secret-connect-gate";
    const req = new NextRequest("http://localhost:3000/connect");
    expect(connectGateAuthorized(req)).toBe(false);
  });
});
