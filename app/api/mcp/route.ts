import { createMcpHandler } from "mcp-handler";
import { registerPinterestTools } from "@/src/mcp/register";
import { isMcpAuthorized } from "@/src/mcp/auth";

const innerHandler = createMcpHandler(
  (server) => {
    registerPinterestTools(server);
  },
  {
    serverInfo: {
      name: "pinterest-ads-mcp",
      version: "0.1.0",
    },
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

async function authorizedHandler(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const auth = request.headers.get("authorization");
  if (!isMcpAuthorized(auth, host)) {
    return new Response(JSON.stringify({ error: "Unauthorized MCP request" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="pinterest-ads-mcp"',
      },
    });
  }
  return innerHandler(request);
}

export { authorizedHandler as GET, authorizedHandler as POST };
