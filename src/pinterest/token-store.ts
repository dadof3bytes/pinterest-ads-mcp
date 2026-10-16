import fs from "node:fs/promises";
import path from "node:path";
import { getEnv, requireEnv } from "@/src/config/env";
import { decryptSecret, encryptSecret } from "@/src/pinterest/token-crypto";

const STORE_PATH = path.join(process.cwd(), ".data", "oauth.json");

export interface StoredOAuth {
  refresh_token_encrypted: string;
  scopes: string[];
  connected_at: string;
  sandbox: boolean;
}

async function readStore(): Promise<StoredOAuth | null> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as StoredOAuth;
  } catch {
    return null;
  }
}

export async function saveRefreshToken(
  refreshToken: string,
  scopes: string[],
  sandbox: boolean,
): Promise<void> {
  const key = requireEnv("TOKEN_ENCRYPTION_KEY");
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const payload: StoredOAuth = {
    refresh_token_encrypted: encryptSecret(refreshToken, key),
    scopes,
    connected_at: new Date().toISOString(),
    sandbox,
  };
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), {
    mode: 0o600,
  });
}

export async function getRefreshToken(): Promise<string | null> {
  const env = getEnv();
  if (env.PINTEREST_REFRESH_TOKEN) {
    return env.PINTEREST_REFRESH_TOKEN;
  }
  if (env.PINTEREST_REFRESH_TOKEN_ENCRYPTED && env.TOKEN_ENCRYPTION_KEY) {
    return decryptSecret(
      env.PINTEREST_REFRESH_TOKEN_ENCRYPTED,
      env.TOKEN_ENCRYPTION_KEY,
    );
  }
  const stored = await readStore();
  if (stored && env.TOKEN_ENCRYPTION_KEY) {
    return decryptSecret(stored.refresh_token_encrypted, env.TOKEN_ENCRYPTION_KEY);
  }
  return null;
}

export async function getConnectionMeta(): Promise<StoredOAuth | null> {
  return readStore();
}
