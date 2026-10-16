/** Pinterest API uses microcurrency: $1 = 1_000_000 in account currency. */
export const MICROCURRENCY_FACTOR = 1_000_000;

export function majorToMicro(major: number): number {
  if (!Number.isFinite(major)) {
    throw new Error("Invalid major currency amount");
  }
  return Math.round(major * MICROCURRENCY_FACTOR);
}

export function microToMajor(micro: number | undefined | null): number | null {
  if (micro === undefined || micro === null) {
    return null;
  }
  return micro / MICROCURRENCY_FACTOR;
}

export function convertMoneyFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[],
  direction: "toMajor" | "toMicro",
): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const field of fields) {
    const val = out[field];
    if (val === undefined || val === null) continue;
    if (typeof val !== "number") continue;
    out[field] =
      direction === "toMajor" ? microToMajor(val) : majorToMicro(val);
  }
  return out as T;
}
