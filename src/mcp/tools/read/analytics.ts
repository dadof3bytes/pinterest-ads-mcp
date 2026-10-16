import { z } from "zod";
import type { ToolRegistryServer } from "@/src/mcp/server-types";
import { toolJson } from "@/src/mcp/tool-response";
import { adAccountSchema, readOnly } from "@/src/mcp/schemas/common";
import { pinterestRequest, resolveAdAccountId } from "@/src/pinterest/client";

const DEFAULT_COLUMNS = [
  "SPEND_IN_DOLLAR",
  "IMPRESSION_1",
  "OUTBOUND_CLICK_1",
  "TOTAL_CLICKTHROUGH",
  "CTR",
  "CPC_IN_MICRO_DOLLAR",
  "TOTAL_CHECKOUT",
  "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
];

const levelSchema = z.enum([
  "ACCOUNT",
  "CAMPAIGN",
  "AD_GROUP",
  "AD",
  "PRODUCT_GROUP",
]);

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (24 * 3600 * 1000));
}

function analyticsPath(
  level: z.infer<typeof levelSchema>,
  accountId: string,
): string {
  switch (level) {
    case "ACCOUNT":
      return `/ad_accounts/${accountId}/analytics`;
    case "CAMPAIGN":
      return `/ad_accounts/${accountId}/campaigns/analytics`;
    case "AD_GROUP":
      return `/ad_accounts/${accountId}/ad_groups/analytics`;
    case "AD":
      return `/ad_accounts/${accountId}/ads/analytics`;
    case "PRODUCT_GROUP":
      return `/ad_accounts/${accountId}/product_groups/analytics`;
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function registerAnalyticsTools(server: ToolRegistryServer): void {
  server.registerTool(
    "pinterest_get_analytics",
    {
      description:
        "Sync analytics for a short window and small entity set. For large requests use pinterest_create_report instead. Invalid metric columns? Call pinterest_list_metrics.",
      inputSchema: adAccountSchema.extend({
        level: levelSchema,
        start_date: z.string().describe("YYYY-MM-DD UTC"),
        end_date: z.string().describe("YYYY-MM-DD UTC"),
        granularity: z.enum(["TOTAL", "DAY", "HOUR", "WEEK", "MONTH"]).optional(),
        entity_ids: z.array(z.string()).optional(),
        columns: z.array(z.string()).optional(),
        click_window_days: z.number().int().optional(),
        engagement_window_days: z.number().int().optional(),
        view_window_days: z.number().int().optional(),
        conversion_report_time: z.enum(["TIME_OF_AD_ACTION", "TIME_OF_CONVERSION"]).optional(),
      }),
      annotations: readOnly,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);
      const span = daysBetween(input.start_date, input.end_date);
      const ids = input.entity_ids ?? [];
      const granularity = input.granularity ?? "TOTAL";

      if (span > 31 || ids.length > 100 || granularity === "HOUR") {
        return toolJson({
          error: "sync_request_too_large",
          message:
            "Sync analytics refused. Use pinterest_create_report for long ranges, >100 entities, or HOUR granularity.",
          suggested_tool: "pinterest_create_report",
        });
      }

      const path = analyticsPath(input.level, accountId);
      const data = await pinterestRequest(path, {
        query: {
          start_date: input.start_date,
          end_date: input.end_date,
          granularity,
          columns: (input.columns ?? DEFAULT_COLUMNS).join(","),
          campaign_ids: input.level === "CAMPAIGN" ? ids.join(",") : undefined,
          ad_group_ids: input.level === "AD_GROUP" ? ids.join(",") : undefined,
          ad_ids: input.level === "AD" ? ids.join(",") : undefined,
          click_window_days: input.click_window_days,
          engagement_window_days: input.engagement_window_days,
          view_window_days: input.view_window_days,
          conversion_report_time: input.conversion_report_time,
        },
      });
      return toolJson(data);
    },
  );

  server.registerTool(
    "pinterest_create_report",
    {
      description:
        "Create an async analytics report job. Optionally list templates or create from template_id. Poll with pinterest_get_report.",
      inputSchema: adAccountSchema.extend({
        mode: z
          .enum(["custom", "list_templates", "from_template"])
          .default("custom"),
        template_id: z.string().optional(),
        report_body: z.record(z.string(), z.unknown()).optional(),
        page_size: z.number().int().optional(),
        bookmark: z.string().optional(),
      }),
      annotations: readOnly,
    },
    async (input) => {
      const accountId = resolveAdAccountId(input.ad_account_id);

      if (input.mode === "list_templates") {
        const templates = await pinterestRequest(
          `/ad_accounts/${accountId}/templates`,
          {
            query: {
              page_size: input.page_size ?? 25,
              bookmark: input.bookmark,
            },
          },
        );
        return toolJson(templates);
      }

      if (input.mode === "from_template") {
        if (!input.template_id) {
          throw new Error("template_id is required when mode=from_template");
        }
        const created = await pinterestRequest(
          `/ad_accounts/${accountId}/templates/${input.template_id}/reports`,
          { method: "POST", body: input.report_body ?? {} },
        );
        return toolJson(created);
      }

      if (!input.report_body) {
        throw new Error("report_body is required when mode=custom");
      }
      const created = await pinterestRequest(
        `/ad_accounts/${accountId}/reports`,
        { method: "POST", body: input.report_body },
      );
      return toolJson(created);
    },
  );

  server.registerTool(
    "pinterest_get_report",
    {
      description: "Poll async report status and download URL by report token.",
      inputSchema: adAccountSchema.extend({
        token: z.string(),
      }),
      annotations: readOnly,
    },
    async ({ ad_account_id, token }) => {
      const accountId = resolveAdAccountId(ad_account_id);
      const data = await pinterestRequest(
        `/ad_accounts/${accountId}/reports`,
        { query: { token } },
      );
      return toolJson(data);
    },
  );

  server.registerTool(
    "pinterest_list_metrics",
    {
      description:
        "Live delivery metrics dictionary (API metric names and definitions). Use these names in analytics columns.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => {
      const data = await pinterestRequest("/resources/delivery_metrics");
      return toolJson(data);
    },
  );

  server.registerTool(
    "pinterest_metrics_ready",
    {
      description: "Conversion and non-conversion metrics ready state for a date.",
      inputSchema: z.object({
        date: z.string().describe("YYYY-MM-DD"),
      }),
      annotations: readOnly,
    },
    async ({ date }) => {
      const data = await pinterestRequest("/resources/metrics_ready_state", {
        query: { date },
      });
      return toolJson(data);
    },
  );
}
