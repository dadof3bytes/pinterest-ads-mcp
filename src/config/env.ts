import { z } from "zod";

const envSchema = z.object({
  PINTEREST_APP_ID: z.string().min(1).optional(),
  PINTEREST_APP_SECRET: z.string().min(1).optional(),
  PINTEREST_REDIRECT_URI: z.string().url().optional(),
  PINTEREST_AD_ACCOUNT_ID: z.string().min(1).optional(),
  PINTEREST_USE_SANDBOX: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
  PINTEREST_REFRESH_TOKEN: z.string().optional(),
  PINTEREST_REFRESH_TOKEN_ENCRYPTED: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  MCP_AUTH_TOKEN: z.string().min(16).optional(),
  DRAFT_SIGNING_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  OAUTH_STATE_SECRET: z.string().min(16).optional(),
  PINTEREST_CONTINUOUS_REFRESH: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

export function requireEnv<K extends keyof Env>(
  key: K,
): NonNullable<Env[K]> {
  const env = getEnv();
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return value as NonNullable<Env[K]>;
}
