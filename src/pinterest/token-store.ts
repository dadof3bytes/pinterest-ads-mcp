import fs from "node:fs/promises";
import path from "node:path";
import { getEnv, requireEnv } from "@/src/config/env";
import { decryptSecret, encryptSecret } from "@/src/pinterest/token-crypto";

const STORE_PATH = path.join(process.cwd(), ".data", "oauth.json");

export const OAUTH_SETUP_COOKIE = "pinterest_oauth_setup";

export interface StoredOAuth {
  refresh_token_encrypted: string;
  scopes: string[];
  connected_at: string;
  sandbox: boolean;
}

export type SaveRefreshTokenResult =
  | { storage: "file"; meta: StoredOAuth }
  | {
      storage: "environment";
      encrypted_for_env: string;
      meta: StoredOAuth;
    };

/** Vercel and similar hosts cannot persist writes under the app directory. */
export function shouldUseEnvironmentTokenStorage(): boolean {
  if (process.env.DISABLE_OAUTH_FILE_STORE === "1") {
    return true;
  }
  if (process.env.VERCEL === "1") {
    return true;
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return true;
  }
  return false;
}

function isReadonlyFilesystemError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const code = (err as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "EROFS" || code === "EACCES" || code === "EPERM";
}

async function readStore(): Promise<StoredOAuth | null> {
  if (shouldUseEnvironmentTokenStorage()) {
    return null;
  }
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
): Promise<SaveRefreshTokenResult> {
  const key = requireEnv("TOKEN_ENCRYPTION_KEY");
  const refresh_token_encrypted = encryptSecret(refreshToken, key);
  const meta: StoredOAuth = {
    refresh_token_encrypted,
    scopes,
    connected_at: new Date().toISOString(),
    sandbox,
  };

  if (shouldUseEnvironmentTokenStorage()) {
    return {
      storage: "environment",
      encrypted_for_env: refresh_token_encrypted,
      meta,
    };
  }

  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(meta, null, 2), {
      mode: 0o600,
    });
    return { storage: "file", meta };
  } catch (err) {
    if (isReadonlyFilesystemError(err)) {
      return {
        storage: "environment",
        encrypted_for_env: refresh_token_encrypted,
        meta,
      };
    }
    throw err;
  }
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
  const fromFile = await readStore();
  if (fromFile) {
    return fromFile;
  }
  const env = getEnv();
  if (env.PINTEREST_REFRESH_TOKEN_ENCRYPTED) {
    return {
      refresh_token_encrypted: env.PINTEREST_REFRESH_TOKEN_ENCRYPTED,
      scopes: [],
      connected_at: "PINTEREST_REFRESH_TOKEN_ENCRYPTED (environment)",
      sandbox: env.PINTEREST_USE_SANDBOX === true,
    };
  }
  if (env.PINTEREST_REFRESH_TOKEN) {
    return {
      refresh_token_encrypted: "(plain refresh token in environment)",
      scopes: [],
      connected_at: "PINTEREST_REFRESH_TOKEN (environment)",
      sandbox: env.PINTEREST_USE_SANDBOX === true,
    };
  }
  return null;
}
