import { describe, expect, it } from "vitest";
import { paginateResponse } from "@/src/pinterest/client";

describe("pagination", () => {
  it("sets has_more from bookmark", () => {
    const page = paginateResponse({ items: [1, 2], bookmark: "abc" });
    expect(page.has_more).toBe(true);
    expect(page.bookmark).toBe("abc");
  });
});
