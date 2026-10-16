/** Objectives allowed on create (Phase 2 writes). */
export const CREATE_OBJECTIVES = ["SALES", "LEADS"] as const;
export type CreateObjective = (typeof CREATE_OBJECTIVES)[number];

/** Legacy objectives still returned on read until Pinterest archival cutoff. */
export const LEGACY_READ_OBJECTIVES = [
  "CATALOG_SALES",
  "WEB_CONVERSION",
  "AWARENESS",
  "CONSIDERATION",
  "VIDEO_VIEW",
  "VIDEO_COMPLETION",
  "WEB_SESSIONS",
  "ENGAGEMENT",
  "APP_INSTALL",
] as const;

export function assertCreateObjective(
  objective: string,
): asserts objective is CreateObjective {
  if (!(CREATE_OBJECTIVES as readonly string[]).includes(objective)) {
    throw new Error(
      `Invalid create objective "${objective}". Allowed: ${CREATE_OBJECTIVES.join(", ")}.`,
    );
  }
}
