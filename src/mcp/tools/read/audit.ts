import { z } from "zod";
import type { ToolRegistryServer } from "@/src/mcp/server-types";
import { toolJson } from "@/src/mcp/tool-response";
import { adAccountSchema, readOnly } from "@/src/mcp/schemas/common";
import {
  DEFAULT_PAGE_SIZE,
  pinterestRequest,
  resolveAdAccountId,
} from "@/src/pinterest/client";

type ControlStatus = "observed" | "unknown" | "not_applicable";

interface ControlEvidence {
  control_id: string;
  status: ControlStatus;
  evidence: unknown;
  notes?: string;
}

export function registerAuditTools(server: ToolRegistryServer): void {
  server.registerTool(
    "pinterest_audit_snapshot",
    {
      description:
        "Read-only evidence bundle for ads-pinterest PN-* controls. Returns observations only — no health score.",
      inputSchema: adAccountSchema.extend({
        date_window_days: z.number().int().min(1).max(30).optional(),
        named_experiment: z.string().optional(),
      }),
      annotations: readOnly,
    },
    async ({ ad_account_id, date_window_days, named_experiment }) => {
      const accountId = resolveAdAccountId(ad_account_id);
      const end = new Date();
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (date_window_days ?? 7));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const [
        account,
        tos,
        conversionTags,
        advertiserEvents,
        catalogs,
        campaigns,
        adGroups,
        ads,
        audiences,
        metricsReady,
      ] = await Promise.all([
        pinterestRequest(`/ad_accounts/${accountId}`),
        pinterestRequest(`/ad_accounts/${accountId}/terms_of_service`).catch(
          () => null,
        ),
        pinterestRequest(`/ad_accounts/${accountId}/conversion_tags`).catch(
          () => ({ items: [] }),
        ),
        pinterestRequest(
          `/ad_accounts/${accountId}/advertiser_defined_events`,
        ).catch(() => ({ items: [] })),
        pinterestRequest(`/ad_accounts/${accountId}/catalogs`).catch(() => ({
          items: [],
        })),
        pinterestRequest<{ items?: unknown[] }>(
          `/ad_accounts/${accountId}/campaigns`,
          { query: { page_size: DEFAULT_PAGE_SIZE } },
        ),
        pinterestRequest<{ items?: unknown[] }>(
          `/ad_accounts/${accountId}/ad_groups`,
          { query: { page_size: DEFAULT_PAGE_SIZE } },
        ),
        pinterestRequest<{ items?: unknown[] }>(
          `/ad_accounts/${accountId}/ads`,
          { query: { page_size: DEFAULT_PAGE_SIZE } },
        ),
        pinterestRequest(`/ad_accounts/${accountId}/audiences`).catch(() => ({
          items: [],
        })),
        pinterestRequest("/resources/metrics_ready_state", {
          query: { date: fmt(end) },
        }).catch(() => null),
      ]);

      const campaignItems = campaigns.items ?? [];
      const hasCatalogObjective = campaignItems.some((c) => {
        const obj = (c as { objective_type?: string }).objective_type;
        return obj === "CATALOG_SALES" || obj === "SALES";
      });

      const controls: ControlEvidence[] = [];

      controls.push({
        control_id: "PN-M01",
        status: "observed",
        evidence: {
          conversion_tags: conversionTags,
          note: "Browser tag install and consent flags are not visible via API",
        },
        notes: "Tag install/consent may be unknown",
      });
      controls.push({
        control_id: "PN-M02",
        status: "observed",
        evidence: { conversion_tags: conversionTags },
      });
      controls.push({
        control_id: "PN-M03",
        status: "unknown",
        evidence: null,
        notes: "Conversion EQS not exposed in v1 snapshot",
      });
      controls.push({
        control_id: "PN-M04",
        status: "observed",
        evidence: { advertiser_defined_events: advertiserEvents },
      });

      controls.push({
        control_id: "PN-R01",
        status: hasCatalogObjective ? "observed" : "not_applicable",
        evidence: hasCatalogObjective ? { catalogs } : null,
      });
      controls.push({
        control_id: "PN-R02",
        status: hasCatalogObjective ? "observed" : "not_applicable",
        evidence: hasCatalogObjective
          ? { catalogs, note: "Feed processing polled at catalog list level" }
          : null,
      });
      controls.push({
        control_id: "PN-R03",
        status: hasCatalogObjective ? "unknown" : "not_applicable",
        evidence: null,
        notes: "Claimed domain verification detail not fetched in v1",
      });

      controls.push({
        control_id: "PN-S01",
        status: "observed",
        evidence: {
          campaigns: campaignItems.map((c) => ({
            id: (c as { id?: string }).id,
            objective_type: (c as { objective_type?: string }).objective_type,
            status: (c as { status?: string }).status,
          })),
        },
      });
      controls.push({
        control_id: "PN-S02",
        status: "observed",
        evidence: {
          ad_groups: (adGroups.items ?? []).slice(0, 10).map((g) => ({
            id: (g as { id?: string }).id,
            optimization_goal_metadata: (g as { optimization_goal_metadata?: unknown })
              .optimization_goal_metadata,
            bid_strategy_type: (g as { bid_strategy_type?: string }).bid_strategy_type,
          })),
        },
      });

      controls.push({
        control_id: "PN-A01",
        status: "observed",
        evidence: {
          ad_group_targeting_sample: (adGroups.items ?? [])
            .slice(0, 5)
            .map((g) => ({
              id: (g as { id?: string }).id,
              targeting_spec: (g as { targeting_spec?: unknown }).targeting_spec,
            })),
          audiences_summary: (audiences as { items?: unknown[] }).items?.map(
            (a) => ({
              id: (a as { id?: string }).id,
              audience_type: (a as { audience_type?: string }).audience_type,
              size: (a as { size?: number }).size,
            }),
          ),
        },
        notes: "Customer list emails are never returned",
      });

      controls.push({
        control_id: "PN-C01",
        status: "observed",
        evidence: {
          ads_sample: (ads.items ?? []).slice(0, 10).map((a) => ({
            id: (a as { id?: string }).id,
            creative_type: (a as { creative_type?: string }).creative_type,
            pin_id: (a as { pin_id?: string }).pin_id,
          })),
        },
      });
      controls.push({
        control_id: "PN-C02",
        status: "observed",
        evidence: {
          ads_destination: (ads.items ?? []).slice(0, 10).map((a) => ({
            id: (a as { id?: string }).id,
            destination_url: (a as { destination_url?: string }).destination_url,
          })),
        },
      });
      controls.push({
        control_id: "PN-C03",
        status: "unknown",
        evidence: null,
        notes: "Landing page quality not fetched in v1",
      });

      controls.push({
        control_id: "PN-B01",
        status: "observed",
        evidence: {
          account,
          recent_spend_window: { start: fmt(start), end: fmt(end) },
          metrics_ready: metricsReady,
        },
      });

      controls.push({
        control_id: "PN-P01",
        status: "observed",
        evidence: {
          terms_of_service: tos,
          policy_note: "Creative/regulated category adjudication not available via API",
        },
      });

      controls.push({
        control_id: "PN-E01",
        status: named_experiment ? "observed" : "not_applicable",
        evidence: named_experiment
          ? { named_experiment, note: "No first-class experiments API" }
          : null,
      });

      return toolJson({
        ad_account_id: accountId,
        generated_at: new Date().toISOString(),
        health_score: null,
        controls,
        raw_counts: {
          campaigns: campaignItems.length,
          ad_groups: (adGroups.items ?? []).length,
          ads: (ads.items ?? []).length,
        },
      });
    },
  );
}
