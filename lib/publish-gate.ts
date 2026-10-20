import { closedLicenceFullTextError } from "./copyright";
import { sanitizeHttpUrl } from "./http-url";

/** Why this article must not go live. Null when source URL, caveats, and copyright are fine. */
export function publishBlocker(input: {
  sourceUrl?: string | null;
  caveats?: string | null;
  licence?: string | null;
  plainExplanation?: string | null;
  sourceText?: string | null;
  sourceFingerprint?: string | null;
}): string | null {
  if (!sanitizeHttpUrl(input.sourceUrl)) {
    return "A source URL is required before publishing.";
  }
  if (!input.caveats || !String(input.caveats).trim()) {
    return "Caveats are required before publishing.";
  }
  return closedLicenceFullTextError({
    licence: input.licence,
    body: input.plainExplanation,
    sourceText: input.sourceText,
    sourceFingerprint: input.sourceFingerprint,
  });
}

export class PublishGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishGateError";
  }
}
