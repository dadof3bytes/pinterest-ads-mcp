import type { ToolRegistryServer } from "@/src/mcp/server-types";
import { registerAccountTools } from "@/src/mcp/tools/read/account";
import { registerAnalyticsTools } from "@/src/mcp/tools/read/analytics";
import { registerAuditTools } from "@/src/mcp/tools/read/audit";
import { registerTargetingTools } from "@/src/mcp/tools/read/targeting";
import { registerTreeTools } from "@/src/mcp/tools/read/tree";
import { registerWriteTools } from "@/src/mcp/tools/write/mutations";

const FORBIDDEN_TOOL_PREFIXES = [
  "pinterest_business",
  "pinterest_partner",
  "pinterest_ssio",
  "pinterest_delete",
];

/** Register all Pinterest Ads MCP tools on the given server instance. */
export function registerPinterestTools(server: ToolRegistryServer): void {
  registerAccountTools(server);
  registerTreeTools(server);
  registerAnalyticsTools(server);
  registerTargetingTools(server);
  registerAuditTools(server);
  registerWriteTools(server);
}

/** Guardrail for CI/tests: agency and delete tools must never be registered here. */
export function assertToolRegistryPolicy(toolNames: string[]): void {
  for (const name of toolNames) {
    for (const prefix of FORBIDDEN_TOOL_PREFIXES) {
      if (name.startsWith(prefix)) {
        throw new Error(`Forbidden tool registered: ${name}`);
      }
    }
    if (name.includes("_delete_")) {
      throw new Error(`Delete tools are not allowed: ${name}`);
    }
  }
}
