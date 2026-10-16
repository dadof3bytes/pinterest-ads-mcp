import { describe, expect, it } from "vitest";
import { assertCreateObjective } from "@/src/pinterest/objectives";

describe("objectives", () => {
  it("allows SALES and LEADS on create", () => {
    expect(() => assertCreateObjective("SALES")).not.toThrow();
    expect(() => assertCreateObjective("LEADS")).not.toThrow();
  });

  it("rejects legacy objectives on create", () => {
    expect(() => assertCreateObjective("AWARENESS")).toThrow();
  });
});
