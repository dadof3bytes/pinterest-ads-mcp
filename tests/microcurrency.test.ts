import { describe, expect, it } from "vitest";
import { majorToMicro, microToMajor } from "@/src/pinterest/microcurrency";

describe("microcurrency", () => {
  it("converts major to micro and back", () => {
    expect(majorToMicro(1)).toBe(1_000_000);
    expect(microToMajor(1_000_000)).toBe(1);
    expect(microToMajor(2_500_000)).toBe(2.5);
  });
});
