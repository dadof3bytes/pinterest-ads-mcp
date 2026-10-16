import { getEnv } from "@/src/config/env";

export function verifyMcpBearer(authHeader: string | null): boolean {
  const token = getEnv().MCP_AUTH_TOKEN;
  if (!token) {
    return true;
  }
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  return authHeader.slice("Bearer ".length) === token;
}

export function isLocalhostRequest(host: string | null): boolean {
  if (!host) return false;
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export function isMcpAuthorized(
  authHeader: string | null,
  host: string | null,
): boolean {
  const env = getEnv();
  if (!env.MCP_AUTH_TOKEN) {
    return true;
  }
  if (isLocalhostRequest(host) && verifyMcpBearer(authHeader)) {
    return true;
  }
  if (isLocalhostRequest(host) && !authHeader) {
    return true;
  }
  return verifyMcpBearer(authHeader);
}
