import type { McpServer } from "@modelcontextprotocol/server";

/** Shared surface used by HTTP handler and stdio entry. */
export type ToolRegistryServer = Pick<McpServer, "registerTool">;
