import { describe, expect, it } from "vitest";

describe("Pinterest OAuth Basic auth encoding", () => {
  it("matches RFC 7617 base64 of client_id:client_secret", () => {
    const appId = "1234567";
    const appSecret = "shhh";
    const encoded = Buffer.from(`${appId}:${appSecret}`, "utf8").toString("base64");
    expect(encoded).toBe("MTIzNDU2NzpzaGho");
    expect(`Basic ${encoded}`).toBe("Basic MTIzNDU2NzpzaGho");
  });
});
