import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv, requireEnv } from "@/src/config/env";

export type DraftKind =
  | "create_campaign"
  | "update_campaign"
  | "create_ad_group"
  | "update_ad_group"
  | "create_pin"
  | "create_ad"
  | "update_ad"
  | "create_keyword"
  | "update_keyword"
  | "update_status";

export interface DraftPayload {
  kind: DraftKind;
  ad_account_id: string;
  idempotency_key: string;
  body: Record<string, unknown>;
  path_params?: Record<string, string>;
  issued_at: number;
  expires_at: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function signingSecret(): string {
  const env = getEnv();
  return env.DRAFT_SIGNING_SECRET ?? requireEnv("TOKEN_ENCRYPTION_KEY");
}

function sign(encoded: string): string {
  return createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
}

export function createDraftToken(
  draft: Omit<DraftPayload, "issued_at" | "expires_at">,
  ttlMs = DEFAULT_TTL_MS,
): string {
  const payload: DraftPayload = {
    ...draft,
    issued_at: Date.now(),
    expires_at: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyDraftToken(token: string): DraftPayload {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) {
    throw new Error("Invalid draft token format");
  }
  const expected = sign(encoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid draft token signature");
  }
  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as DraftPayload;
  if (Date.now() > payload.expires_at) {
    throw new Error("Draft token expired; call the preview/draft tool again");
  }
  return payload;
}

export function isDraftExpired(payload: DraftPayload, now = Date.now()): boolean {
  return now > payload.expires_at;
}
