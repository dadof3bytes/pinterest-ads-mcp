import type { DraftKind } from "@/src/pinterest/draft-token";

const INTERNAL_BODY_KEYS = new Set(["archive_confirmed"]);

export interface PinterestWriteRequest {
  method: "POST" | "PATCH";
  path: string;
  body: unknown;
  readBeforePath?: string;
}

function stripInternalFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!INTERNAL_BODY_KEYS.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

function buildKeywordCreateBody(item: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(item.keywords) && item.parent_id) {
    return item;
  }
  const parentId = item.parent_id;
  if (typeof parentId !== "string" || !parentId) {
    throw new Error("Keyword create requires parent_id in the draft payload.");
  }
  const keywordFields = stripInternalFields(item);
  delete keywordFields.parent_id;
  return {
    parent_id: parentId,
    keywords: [keywordFields],
  };
}

function buildKeywordUpdateBody(
  item: Record<string, unknown>,
  keywordId: string,
): Record<string, unknown> {
  if (Array.isArray(item.keywords)) {
    return item;
  }
  return {
    keywords: [{ id: keywordId, ...stripInternalFields(item) }],
  };
}

/** Map draft kinds to Pinterest v5 batch write endpoints and bodies. */
export function buildPinterestWriteRequest(input: {
  kind: DraftKind;
  adAccountId: string;
  body: Record<string, unknown>;
  pathParams?: Record<string, string>;
}): PinterestWriteRequest {
  const { kind, adAccountId, pathParams } = input;
  const item = stripInternalFields(input.body);
  const base = `/ad_accounts/${adAccountId}`;

  switch (kind) {
    case "create_campaign":
      return {
        method: "POST",
        path: `${base}/campaigns`,
        body: [item],
      };
    case "update_campaign": {
      const campaignId = pathParams?.campaign_id;
      if (!campaignId) {
        throw new Error("campaign_id required for campaign update.");
      }
      return {
        method: "PATCH",
        path: `${base}/campaigns`,
        body: [{ id: campaignId, ...item }],
        readBeforePath: `${base}/campaigns/${campaignId}`,
      };
    }
    case "create_ad_group":
      return {
        method: "POST",
        path: `${base}/ad_groups`,
        body: [item],
      };
    case "update_ad_group": {
      const adGroupId = pathParams?.ad_group_id;
      if (!adGroupId) {
        throw new Error("ad_group_id required for ad group update.");
      }
      return {
        method: "PATCH",
        path: `${base}/ad_groups`,
        body: [{ id: adGroupId, ...item }],
        readBeforePath: `${base}/ad_groups/${adGroupId}`,
      };
    }
    case "create_pin":
      return {
        method: "POST",
        path: "/pins",
        body: item,
      };
    case "create_ad":
      return {
        method: "POST",
        path: `${base}/ads`,
        body: [item],
      };
    case "update_ad": {
      const adId = pathParams?.ad_id;
      if (!adId) {
        throw new Error("ad_id required for ad update.");
      }
      return {
        method: "PATCH",
        path: `${base}/ads`,
        body: [{ id: adId, ...item }],
        readBeforePath: `${base}/ads/${adId}`,
      };
    }
    case "create_keyword":
      return {
        method: "POST",
        path: `${base}/keywords`,
        body: buildKeywordCreateBody(item),
      };
    case "update_keyword": {
      const keywordId = pathParams?.keyword_id;
      if (!keywordId) {
        throw new Error("keyword_id required for keyword update.");
      }
      return {
        method: "PATCH",
        path: `${base}/keywords`,
        body: buildKeywordUpdateBody(item, keywordId),
      };
    }
    case "update_status": {
      const entityType = pathParams?.entity_type;
      const entityId = pathParams?.entity_id;
      if (!entityType || !entityId) {
        throw new Error("entity_type and entity_id required for status update.");
      }
      return {
        method: "PATCH",
        path: `${base}/${entityType}`,
        body: [{ id: entityId, ...item }],
        readBeforePath: `${base}/${entityType}/${entityId}`,
      };
    }
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled draft kind: ${String(_exhaustive)}`);
    }
  }
}

export function formatPinterestErrorBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    return typeof body === "string" ? body : "Unknown Pinterest error";
  }
  const record = body as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.message === "string") {
    parts.push(record.message);
  }
  if (typeof record.code === "number" || typeof record.code === "string") {
    parts.push(`code=${String(record.code)}`);
  }
  if (typeof record.error_description === "string") {
    parts.push(record.error_description);
  }
  if (typeof record.error === "string") {
    parts.push(record.error);
  }
  if (parts.length > 0) {
    return parts.join(" — ");
  }
  return JSON.stringify(body);
}

function collectKeywordErrors(errors: unknown[]): string[] {
  const messages: string[] = [];
  for (const entry of errors) {
    if (!entry || typeof entry !== "object") {
      messages.push(JSON.stringify(entry));
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (Array.isArray(row.error_messages)) {
      for (const msg of row.error_messages) {
        if (typeof msg === "string") {
          messages.push(msg);
        }
      }
    }
  }
  return messages;
}

/** HTTP 200 batch responses may still contain per-item failures. */
export function assertBatchWriteSucceeded(
  response: unknown,
  operation: string,
): void {
  if (!response || typeof response !== "object") {
    return;
  }
  const obj = response as Record<string, unknown>;
  const errors: string[] = [];

  if (Array.isArray(obj.items)) {
    for (const [index, item] of obj.items.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as Record<string, unknown>;
      const exceptions = row.exceptions;
      if (Array.isArray(exceptions) && exceptions.length > 0) {
        for (const exc of exceptions) {
          if (exc && typeof exc === "object" && typeof (exc as { message?: string }).message === "string") {
            errors.push(`item[${index}]: ${(exc as { message: string }).message}`);
          } else {
            errors.push(`item[${index}]: ${JSON.stringify(exc)}`);
          }
        }
      } else if (
        exceptions &&
        typeof exceptions === "object" &&
        typeof (exceptions as { message?: string }).message === "string"
      ) {
        errors.push(`item[${index}]: ${(exceptions as { message: string }).message}`);
      }
      if (!row.data || (typeof row.data === "object" && Object.keys(row.data as object).length === 0)) {
        if (exceptions) {
          continue;
        }
      }
    }
  }

  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    errors.push(...collectKeywordErrors(obj.errors));
  }

  if (errors.length > 0) {
    throw new Error(`${operation} rejected by Pinterest: ${errors.join("; ")}`);
  }
}
