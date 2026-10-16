import { afterEach, describe, expect, it } from "vitest";
import { shouldUseEnvironmentTokenStorage } from "@/src/pinterest/token-store";

describe("shouldUseEnvironmentTokenStorage", () => {
  const prior = { ...process.env };

  afterEach(() => {
    process.env = { ...prior };
  });

  it("returns true on Vercel", () => {
    process.env.VERCEL = "1";
    expect(shouldUseEnvironmentTokenStorage()).toBe(true);
  });

  it("returns false on local dev by default", () => {
    delete process.env.VERCEL;
    delete process.env.DISABLE_OAUTH_FILE_STORE;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    expect(shouldUseEnvironmentTokenStorage()).toBe(false);
  });
});
