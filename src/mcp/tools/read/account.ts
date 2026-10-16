import { z } from "zod";
import type { ToolRegistryServer } from "@/src/mcp/server-types";
import { toolJson } from "@/src/mcp/tool-response";
import { adAccountSchema, readOnly } from "@/src/mcp/schemas/common";
import { getEnv } from "@/src/config/env";
import { pinterestRequest, resolveAdAccountId } from "@/src/pinterest/client";

export function registerAccountTools(server: ToolRegistryServer): void {
  server.registerTool(
    "pinterest_get_account",
    {
      description:
        "Get the configured ad account, authorized user summary, and terms-of-service state.",
      inputSchema: adAccountSchema,
      annotations: readOnly,
    },
    async ({ ad_account_id }) => {
      const accountId = resolveAdAccountId(ad_account_id);
      const [account, user, tos] = await Promise.all([
        pinterestRequest(`/ad_accounts/${accountId}`),
        pinterestRequest("/user_account").catch(() => null),
        pinterestRequest(`/ad_accounts/${accountId}/terms_of_service`).catch(
          () => ({ status: "unknown" }),
        ),
      ]);
      return toolJson({
        ad_account_id: accountId,
        ad_account: account,
        user_account: user,
        terms_of_service: tos,
      });
    },
  );

  server.registerTool(
    "pinterest_list_ad_accounts",
    {
      description:
        "List ad accounts owned by the authorized user (single-tenant confirmation, not partner browsing).",
      inputSchema: z.object({
        page_size: z.number().int().min(1).max(250).optional(),
        bookmark: z.string().optional(),
      }),
      annotations: readOnly,
    },
    async ({ page_size, bookmark }) => {
      const data = await pinterestRequest<{
        items?: unknown[];
        bookmark?: string | null;
      }>("/ad_accounts", {
        query: {
          page_size: page_size ?? 25,
          bookmark,
        },
      });
      return toolJson({
        configured_ad_account_id: getEnv().PINTEREST_AD_ACCOUNT_ID ?? null,
        items: data.items ?? [],
        bookmark: data.bookmark ?? null,
        has_more: Boolean(data.bookmark),
      });
    },
  );
}
