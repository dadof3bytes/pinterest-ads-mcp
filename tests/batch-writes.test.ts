import { describe, expect, it } from "vitest";
import {
  assertBatchWriteSucceeded,
  buildPinterestWriteRequest,
  formatPinterestErrorBody,
} from "@/src/pinterest/batch-writes";

describe("buildPinterestWriteRequest", () => {
  it("wraps campaign create in a one-item array", () => {
    const req = buildPinterestWriteRequest({
      kind: "create_campaign",
      adAccountId: "123",
      body: { name: "Test", objective_type: "SALES", status: "PAUSED" },
    });
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/ad_accounts/123/campaigns");
    expect(req.body).toEqual([
      { name: "Test", objective_type: "SALES", status: "PAUSED" },
    ]);
  });

  it("uses batch PATCH for campaign update", () => {
    const req = buildPinterestWriteRequest({
      kind: "update_campaign",
      adAccountId: "123",
      body: { status: "ACTIVE" },
      pathParams: { campaign_id: "999" },
    });
    expect(req.method).toBe("PATCH");
    expect(req.path).toBe("/ad_accounts/123/campaigns");
    expect(req.body).toEqual([{ id: "999", status: "ACTIVE" }]);
    expect(req.readBeforePath).toBe("/ad_accounts/123/campaigns/999");
  });

  it("routes entity status to batch collection PATCH", () => {
    const req = buildPinterestWriteRequest({
      kind: "update_status",
      adAccountId: "123",
      body: { status: "PAUSED", archive_confirmed: true },
      pathParams: { entity_type: "campaigns", entity_id: "555" },
    });
    expect(req.path).toBe("/ad_accounts/123/campaigns");
    expect(req.body).toEqual([{ id: "555", status: "PAUSED" }]);
  });
});

describe("formatPinterestErrorBody", () => {
  it("includes Pinterest message and code", () => {
    expect(formatPinterestErrorBody({ code: 2, message: "Invalid parameters." })).toContain(
      "Invalid parameters.",
    );
  });
});

describe("assertBatchWriteSucceeded", () => {
  it("throws when batch item has exceptions", () => {
    expect(() =>
      assertBatchWriteSucceeded(
        {
          items: [
            {
              data: {},
              exceptions: [{ code: 2, message: "Daily spend cap required." }],
            },
          ],
        },
        "create_campaign",
      ),
    ).toThrow(/Daily spend cap required/);
  });

  it("throws on keyword errors array", () => {
    expect(() =>
      assertBatchWriteSucceeded(
        {
          keywords: [],
          errors: [{ error_messages: ["parent_id invalid"] }],
        },
        "create_keyword",
      ),
    ).toThrow(/parent_id invalid/);
  });
});
