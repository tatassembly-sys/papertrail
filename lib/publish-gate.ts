import { sanitizeHttpUrl } from "./http-url";

/** Why this article must not go live. Null when source URL and caveats are present. */
export function publishBlocker(input: {
  sourceUrl?: string | null;
  caveats?: string | null;
}): string | null {
  if (!sanitizeHttpUrl(input.sourceUrl)) {
    return "A source URL is required before publishing.";
  }
  if (!input.caveats || !String(input.caveats).trim()) {
    return "Caveats are required before publishing.";
  }
  return null;
}

export class PublishGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishGateError";
  }
}
