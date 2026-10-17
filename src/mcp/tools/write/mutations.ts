import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ToolRegistryServer } from "@/src/mcp/server-types";
import { toolJson } from "@/src/mcp/tool-response";
import { adAccountSchema, writeApply, writePreview } from "@/src/mcp/schemas/common";
import { assertCreateObjective, CREATE_OBJECTIVES } from "@/src/pinterest/objectives";
import {
  createDraftToken,
  verifyDraftToken,
  type DraftKind,
} from "@/src/pinterest/draft-token";
import { buildPinterestWriteRequest } from "@/src/pinterest/batch-writes";
import {
  prepareWriteBody,
  pinterestRequest,
  pinterestWriteRequest,
  resolveAdAccountId,
} from "@/src/pinterest/client";

const applySchema = z.object({
  draft_token: z.string(),
  confirm: z.literal(true),
});

async function applyDraft(
  draftToken: string,
): Promise<{ before: unknown; after: unknown; idempotency_key: string }> {
  const draft = verifyDraftToken(draftToken);
  const preparedBody = prepareWriteBody(draft.body);
  const write = buildPinterestWriteRequest({
    kind: draft.kind,
    adAccountId: draft.ad_account_id,
    body: preparedBody,
    pathParams: draft.path_params,
  });

  let before: unknown = null;
  if (write.readBeforePath) {
    try {
      before = await pinterestRequest(write.readBeforePath);
    } catch {
      before = null;
    }
  }

  const after = await pinterestWriteRequest(write.path, {
    method: write.method,
    body: write.body,
    idempotencyKey: draft.idempotency_key,
    operationLabel: draft.kind,
  });

  return { before, after, idempotency_key: draft.idempotency_key };
}

function preview(
  kind: DraftKind,
  adAccountId: string,
  body: Record<string, unknown>,
  pathParams?: Record<string, string>,
  idempotencyKey?: string,
) {
  const key = idempotencyKey ?? randomUUID();
  const token = createDraftToken({
    kind,
    ad_account_id: adAccountId,
    idempotency_key: key,
    body,
    path_params: pathParams,
  });
  return toolJson({
    draft_token: token,
    expires_in_seconds: 300,
    preview: { kind, body, path_params: pathParams, idempotency_key: key },
    apply_instructions:
      "Call the matching pinterest_apply_* tool with draft_token and confirm: true",
  });
}

export function registerWriteTools(server: ToolRegistryServer): void {
  server.registerTool(
    "pinterest_draft_campaign",
    {
      description:
        "Preview create/update campaign mutation. New campaigns default PAUSED. Create allows SALES or LEADS only. Budgets in major currency.",
      inputSchema: adAccountSchema.extend({
        operation: z.enum(["create", "update"]),
        campaign_id: z.string().optional(),
        payload: z.record(z.string(), z.unknown()),
        idempotency_key: z.string().optional(),
      }),
      annotations: writePreview,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const payload = { ...input.payload };
      if (input.operation === "create") {
        assertCreateObjective(String(payload.objective_type ?? ""));
        payload.status = payload.status ?? "PAUSED";
      }
      if (input.operation === "update" && !input.campaign_id) {
        throw new Error("campaign_id required for update");
      }
      return preview(
        input.operation === "create" ? "create_campaign" : "update_campaign",
        accountId,
        payload,
        input.campaign_id ? { campaign_id: input.campaign_id } : undefined,
        input.idempotency_key,
      );
    },
  );

  server.registerTool(
    "pinterest_apply_campaign",
    {
      description: "Apply a signed campaign draft when confirm is true.",
      inputSchema: applySchema,
      annotations: writeApply,
    },
    async ({ draft_token, confirm }) => {
      if (!confirm) throw new Error("confirm: true is required");
      const result = await applyDraft(draft_token);
      return toolJson(result);
    },
  );

  server.registerTool(
    "pinterest_draft_ad_group",
    {
      description:
        "Preview create/update ad group. New ad groups default PAUSED. Bid/budget fields accept major currency.",
      inputSchema: adAccountSchema.extend({
        operation: z.enum(["create", "update"]),
        ad_group_id: z.string().optional(),
        payload: z.record(z.string(), z.unknown()),
        idempotency_key: z.string().optional(),
      }),
      annotations: writePreview,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const payload = { ...input.payload };
      if (input.operation === "create") {
        payload.status = payload.status ?? "PAUSED";
      }
      if (input.operation === "update" && !input.ad_group_id) {
        throw new Error("ad_group_id required for update");
      }
      return preview(
        input.operation === "create" ? "create_ad_group" : "update_ad_group",
        accountId,
        payload,
        input.ad_group_id ? { ad_group_id: input.ad_group_id } : undefined,
        input.idempotency_key,
      );
    },
  );

  server.registerTool(
    "pinterest_apply_ad_group",
    {
      description: "Apply a signed ad group draft when confirm is true.",
      inputSchema: applySchema,
      annotations: writeApply,
    },
    async ({ draft_token, confirm }) => {
      if (!confirm) throw new Error("confirm: true is required");
      return toolJson(await applyDraft(draft_token));
    },
  );

  server.registerTool(
    "pinterest_draft_pin",
    {
      description:
        "Preview Pin create (image URL or media upload id). Pin is not published until applied.",
      inputSchema: adAccountSchema.extend({
        payload: z.record(z.string(), z.unknown()),
        idempotency_key: z.string().optional(),
      }),
      annotations: writePreview,
    },
    async (input) => {
      resolveAdAccountId(input.ad_account_id);
      return preview(
        "create_pin",
        resolveAdAccountId(input.ad_account_id),
        input.payload,
        undefined,
        input.idempotency_key,
      );
    },
  );

  server.registerTool(
    "pinterest_apply_pin",
    {
      description: "Apply signed Pin create draft when confirm is true.",
      inputSchema: applySchema,
      annotations: writeApply,
    },
    async ({ draft_token, confirm }) => {
      if (!confirm) throw new Error("confirm: true is required");
      return toolJson(await applyDraft(draft_token));
    },
  );

  server.registerTool(
    "pinterest_draft_ad",
    {
      description:
        "Preview ad create/update. Requires ad_group_id and pin_id on create. Defaults PAUSED.",
      inputSchema: adAccountSchema.extend({
        operation: z.enum(["create", "update"]),
        ad_id: z.string().optional(),
        payload: z.record(z.string(), z.unknown()),
        idempotency_key: z.string().optional(),
      }),
      annotations: writePreview,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const payload: Record<string, unknown> = {
        ...input.payload,
        is_removable: input.payload.is_removable ?? true,
      };
      if (input.operation === "create") {
        payload.status = payload.status ?? "PAUSED";
      }
      if (input.operation === "update" && !input.ad_id) {
        throw new Error("ad_id required for update");
      }
      return preview(
        input.operation === "create" ? "create_ad" : "update_ad",
        accountId,
        payload,
        input.ad_id ? { ad_id: input.ad_id } : undefined,
        input.idempotency_key,
      );
    },
  );

  server.registerTool(
    "pinterest_apply_ad",
    {
      description: "Apply signed ad draft when confirm is true.",
      inputSchema: applySchema,
      annotations: writeApply,
    },
    async ({ draft_token, confirm }) => {
      if (!confirm) throw new Error("confirm: true is required");
      return toolJson(await applyDraft(draft_token));
    },
  );

  server.registerTool(
    "pinterest_draft_keyword",
    {
      description:
        "Preview keyword create/update including negatives. Requires match_type and parent ad group.",
      inputSchema: adAccountSchema.extend({
        operation: z.enum(["create", "update"]),
        keyword_id: z.string().optional(),
        payload: z.record(z.string(), z.unknown()),
        idempotency_key: z.string().optional(),
      }),
      annotations: writePreview,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      if (input.operation === "update" && !input.keyword_id) {
        throw new Error("keyword_id required for update");
      }
      return preview(
        input.operation === "create" ? "create_keyword" : "update_keyword",
        accountId,
        input.payload,
        input.keyword_id ? { keyword_id: input.keyword_id } : undefined,
        input.idempotency_key,
      );
    },
  );

  server.registerTool(
    "pinterest_apply_keyword",
    {
      description: "Apply signed keyword draft when confirm is true.",
      inputSchema: applySchema,
      annotations: writeApply,
    },
    async ({ draft_token, confirm }) => {
      if (!confirm) throw new Error("confirm: true is required");
      return toolJson(await applyDraft(draft_token));
    },
  );

  server.registerTool(
    "pinterest_draft_entity_status",
    {
      description:
        "Preview ACTIVE/PAUSED status change for campaign, ad_group, or ad. ARCHIVED requires separate explicit draft (one-way).",
      inputSchema: adAccountSchema.extend({
        entity_type: z.enum(["campaigns", "ad_groups", "ads"]),
        entity_id: z.string(),
        status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
        idempotency_key: z.string().optional(),
      }),
      annotations: writePreview,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      if (input.status === "ARCHIVED") {
        return preview(
          "update_status",
          accountId,
          { status: "ARCHIVED", archive_confirmed: true },
          {
            entity_type: input.entity_type,
            entity_id: input.entity_id,
          },
          input.idempotency_key,
        );
      }
      return preview(
        "update_status",
        accountId,
        { status: input.status },
        {
          entity_type: input.entity_type,
          entity_id: input.entity_id,
        },
        input.idempotency_key,
      );
    },
  );

  server.registerTool(
    "pinterest_apply_entity_status",
    {
      description: "Apply signed entity status draft when confirm is true.",
      inputSchema: applySchema,
      annotations: writeApply,
    },
    async ({ draft_token, confirm }) => {
      if (!confirm) throw new Error("confirm: true is required");
      return toolJson(await applyDraft(draft_token));
    },
  );

  void CREATE_OBJECTIVES;
}
