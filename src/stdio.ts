import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerPinterestTools } from "@/src/mcp/register";

serveStdio(() => {
  const server = new McpServer(
    { name: "pinterest-ads-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  registerPinterestTools(server);
  return server;
});
