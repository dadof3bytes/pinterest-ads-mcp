import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createDraftToken,
  isDraftExpired,
  verifyDraftToken,
} from "@/src/pinterest/draft-token";

describe("draft token", () => {
  const prev = process.env.TOKEN_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.DRAFT_SIGNING_SECRET = "test-draft-signing-secret-32chars!";
  });
  afterEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = prev;
  });

  it("round-trips and expires", () => {
    const token = createDraftToken(
      {
        kind: "create_campaign",
        ad_account_id: "123",
        idempotency_key: "k1",
        body: { name: "Test" },
      },
      1000,
    );
    const payload = verifyDraftToken(token);
    expect(payload.ad_account_id).toBe("123");
    expect(isDraftExpired(payload, payload.expires_at + 1)).toBe(true);
  });
});
