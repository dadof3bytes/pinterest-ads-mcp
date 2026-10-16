import { z } from "zod";

export const paginationSchema = z.object({
  page_size: z
    .number()
    .int()
    .min(1)
    .max(250)
    .optional()
    .describe("Page size (default 25)"),
  bookmark: z.string().optional().describe("Pagination bookmark from prior page"),
});

export const adAccountSchema = z.object({
  ad_account_id: z
    .string()
    .optional()
    .describe("Ad account id; defaults to PINTEREST_AD_ACCOUNT_ID"),
});

export const entityStatusSchema = z
  .enum(["ACTIVE", "PAUSED", "ARCHIVED"])
  .optional()
  .describe("Filter by entity status");

export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const writePreview = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const writeApply = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;
