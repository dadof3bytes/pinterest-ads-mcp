import { z } from "zod";
import type { ToolRegistryServer } from "@/src/mcp/server-types";
import { toolJson } from "@/src/mcp/tool-response";
import { readOnly } from "@/src/mcp/schemas/common";
import { pinterestRequest } from "@/src/pinterest/client";

const targetingTypeSchema = z.enum([
  "APPTYPE",
  "GENDER",
  "LOCALE",
  "LOCATION",
  "GEO",
  "INTEREST",
  "KEYWORD",
  "AUDIENCE",
  "AGE_BUCKET",
]);

export function registerTargetingTools(server: ToolRegistryServer): void {
  server.registerTool(
    "pinterest_get_targeting_options",
    {
      description:
        "Fetch targeting option trees (interests, locations, geos, devices, etc.) for ad group targeting writes.",
      inputSchema: z.object({
        targeting_type: targetingTypeSchema,
        search_query: z.string().optional(),
        country_code: z.string().optional(),
      }),
      annotations: readOnly,
    },
    async ({ targeting_type, search_query, country_code }) => {
      const data = await pinterestRequest(
        `/resources/targeting/${targeting_type}`,
        {
          query: {
            search_query,
            country_code,
          },
        },
      );
      return toolJson(data);
    },
  );
}
