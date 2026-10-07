/** Stored fetch_queue failure, trimmed for the admin status page. */
export interface QueueErrorDoc {
  error_message?: unknown;
  source?: unknown;
  external_id?: unknown;
  attempts?: unknown;
  status?: unknown;
}

const MAX_MESSAGE = 160;

function redact(message: string): string {
  return message
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|rk)-[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
    .replace(/([?&](?:key|token|secret|password)=)[^&\s]+/gi, "$1[redacted]");
}

/**
 * One line for the latest queue row that already has error_message.
 * Returns null when nothing failed, or the message is empty after cleanup.
 */
export function formatQueueLastError(doc: unknown): string | null {
  if (!doc || typeof doc !== "object") return null;
  const row = doc as QueueErrorDoc;
  if (typeof row.error_message !== "string") return null;
  let message = redact(row.error_message).replace(/\s+/g, " ").trim();
  if (!message) return null;
  if (message.length > MAX_MESSAGE) message = `${message.slice(0, MAX_MESSAGE - 3)}...`;

  const source = typeof row.source === "string" && row.source.trim() ? row.source.trim() : "queue";
  const externalId =
    typeof row.external_id === "string" && row.external_id.trim()
      ? row.external_id.trim().slice(0, 64)
      : "";
  const status = typeof row.status === "string" && row.status.trim() ? row.status.trim() : "";
  const attempts =
    typeof row.attempts === "number" && Number.isFinite(row.attempts)
      ? `${row.attempts} attempts`
      : "";
  const head = [source, externalId, status, attempts].filter(Boolean).join(" ");
  return `${head}: ${message}`;
}
