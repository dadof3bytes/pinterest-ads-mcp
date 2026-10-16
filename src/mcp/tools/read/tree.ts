import { z } from "zod";
import type { ToolRegistryServer } from "@/src/mcp/server-types";
import { toolJson } from "@/src/mcp/tool-response";
import {
  adAccountSchema,
  paginationSchema,
  readOnly,
} from "@/src/mcp/schemas/common";
import {
  DEFAULT_PAGE_SIZE,
  paginateResponse,
  pinterestRequest,
  resolveAdAccountId,
} from "@/src/pinterest/client";

export function registerTreeTools(server: ToolRegistryServer): void {
  server.registerTool(
    "pinterest_list_campaigns",
    {
      description: "List campaigns for an ad account with bookmark pagination.",
      inputSchema: adAccountSchema.merge(paginationSchema).extend({
        campaign_ids: z.array(z.string()).optional(),
        entity_statuses: z
          .array(z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]))
          .optional(),
      }),
      annotations: readOnly,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const data = await pinterestRequest<{ items?: unknown[]; bookmark?: string | null }>(
        `/ad_accounts/${accountId}/campaigns`,
        {
          query: {
            page_size: input.page_size ?? DEFAULT_PAGE_SIZE,
            bookmark: input.bookmark,
            campaign_ids: input.campaign_ids?.join(","),
            entity_statuses: input.entity_statuses?.join(","),
          },
        },
      );
      return toolJson(
        paginateResponse(data),
      );
    },
  );

  server.registerTool(
    "pinterest_get_campaign",
    {
      description: "Get one campaign by id.",
      inputSchema: adAccountSchema.extend({
        campaign_id: z.string(),
      }),
      annotations: readOnly,
    },
    async ({ ad_account_id, campaign_id }) => {
      const accountId = resolveAdAccountId(ad_account_id);
      const data = await pinterestRequest(
        `/ad_accounts/${accountId}/campaigns/${campaign_id}`,
      );
      return toolJson(data);
    },
  );

  server.registerTool(
    "pinterest_list_ad_groups",
    {
      description: "List ad groups; filter by campaign_ids when provided.",
      inputSchema: adAccountSchema.merge(paginationSchema).extend({
        campaign_ids: z.array(z.string()).optional(),
        ad_group_ids: z.array(z.string()).optional(),
        entity_statuses: z
          .array(z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]))
          .optional(),
      }),
      annotations: readOnly,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const data = await pinterestRequest<{ items?: unknown[]; bookmark?: string | null }>(
        `/ad_accounts/${accountId}/ad_groups`,
        {
          query: {
            page_size: input.page_size ?? DEFAULT_PAGE_SIZE,
            bookmark: input.bookmark,
            campaign_ids: input.campaign_ids?.join(","),
            ad_group_ids: input.ad_group_ids?.join(","),
            entity_statuses: input.entity_statuses?.join(","),
          },
        },
      );
      return toolJson(
        paginateResponse(data),
      );
    },
  );

  server.registerTool(
    "pinterest_list_ads",
    {
      description: "List ads; filter by campaign or ad group when provided.",
      inputSchema: adAccountSchema.merge(paginationSchema).extend({
        campaign_ids: z.array(z.string()).optional(),
        ad_group_ids: z.array(z.string()).optional(),
        ad_ids: z.array(z.string()).optional(),
        entity_statuses: z
          .array(z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]))
          .optional(),
      }),
      annotations: readOnly,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const data = await pinterestRequest<{ items?: unknown[]; bookmark?: string | null }>(
        `/ad_accounts/${accountId}/ads`,
        {
          query: {
            page_size: input.page_size ?? DEFAULT_PAGE_SIZE,
            bookmark: input.bookmark,
            campaign_ids: input.campaign_ids?.join(","),
            ad_group_ids: input.ad_group_ids?.join(","),
            ad_ids: input.ad_ids?.join(","),
            entity_statuses: input.entity_statuses?.join(","),
          },
        },
      );
      return toolJson(
        paginateResponse(data),
      );
    },
  );

  server.registerTool(
    "pinterest_list_keywords",
    {
      description: "List keywords for ad groups in the ad account.",
      inputSchema: adAccountSchema.merge(paginationSchema).extend({
        ad_group_id: z.string().optional(),
        match_types: z
          .array(z.enum(["BROAD", "PHRASE", "EXACT", "PHRASE_NEGATIVE", "EXACT_NEGATIVE"]))
          .optional(),
      }),
      annotations: readOnly,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const data = await pinterestRequest<{ items?: unknown[]; bookmark?: string | null }>(
        `/ad_accounts/${accountId}/keywords`,
        {
          query: {
            page_size: input.page_size ?? DEFAULT_PAGE_SIZE,
            bookmark: input.bookmark,
            ad_group_id: input.ad_group_id,
            match_types: input.match_types?.join(","),
          },
        },
      );
      return toolJson(
        paginateResponse(data),
      );
    },
  );
}
