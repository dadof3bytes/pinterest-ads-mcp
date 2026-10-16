import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import {
  assertToolRegistryPolicy,
  registerPinterestTools,
} from "@/src/mcp/register";

describe("tool registry", () => {
  it("registers workflow tools without agency/delete names", () => {
    const names: string[] = [];
    const server = new McpServer(
      { name: "test", version: "0.0.0" },
      { capabilities: { tools: {} } },
    );
    const original = server.registerTool.bind(server);
    server.registerTool = ((name: string, ...rest: unknown[]) => {
      names.push(name);
      return original(name, ...(rest as Parameters<typeof original>));
    }) as typeof server.registerTool;

    registerPinterestTools(server);
    assertToolRegistryPolicy(names);
    expect(names).toContain("pinterest_get_account");
    expect(names).toContain("pinterest_audit_snapshot");
    expect(names.some((n) => n.includes("business"))).toBe(false);
  });
});
