export function toolJson(data: unknown): {
  content: { type: "text"; text: string }[];
  structuredContent: unknown;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

export function toolError(message: string): never {
  throw new Error(message);
}
