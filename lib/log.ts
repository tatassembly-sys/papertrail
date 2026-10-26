/**
 * Structured JSON logger (M7.2). One line per event:
 * {"ts","level","msg","route"?,"requestId"?,"err"?,...ctx}
 * Emails, bearer tokens, JWTs, long hex/base64 tokens and secret-looking keys
 * are redacted so logs never carry PII or credentials.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown> & { route?: string; requestId?: string };

const SECRET_KEY = /pass(word)?|secret|token|authorization|cookie|api[_-]?key|email|hash/i;
const PATTERNS: [RegExp, string][] = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  [/\b(sk|pk|rk|whsec)_(live|test)?_?[A-Za-z0-9]{8,}\b/g, "[key]"],
  [/\b[a-f0-9]{32,}\b/gi, "[token]"],
  [/([?&](token|key|secret|code)=)[^&\s"]+/gi, "$1[redacted]"],
];

export function redactString(s: string): string {
  let out = s;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

export function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (depth > 4) return "[depth]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      ...(typeof (value as { code?: unknown }).code !== "undefined"
        ? { code: (value as { code?: unknown }).code }
        : {}),
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) && k !== "requestId" ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

type Sink = (line: string, level: LogLevel) => void;
const defaultSink: Sink = (line, level) => {
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
};
let sink: Sink = defaultSink;

/** Test hook: capture log lines. Pass nothing to restore stdout/stderr. */
export function setLogSink(next?: Sink): void {
  sink = next ?? defaultSink;
}

export function formatLog(level: LogLevel, msg: string, err?: unknown, ctx?: LogContext): string {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: redactString(msg),
    ...((redact(ctx ?? {}) as Record<string, unknown>) || {}),
  };
  if (err !== undefined) entry.err = redact(err);
  return JSON.stringify(entry);
}

function emit(level: LogLevel, msg: string, err?: unknown, ctx?: LogContext) {
  if (level === "debug" && process.env.LOG_LEVEL !== "debug") return;
  try {
    sink(formatLog(level, msg, err, ctx), level);
  } catch {
    /* logging must never throw */
  }
}

export const log = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, undefined, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, undefined, ctx),
  warn: (msg: string, err?: unknown, ctx?: LogContext) => emit("warn", msg, err, ctx),
  error: (msg: string, err?: unknown, ctx?: LogContext) => emit("error", msg, err, ctx),
};

/** Request id from common proxy headers, or a fresh one. */
export function requestIdFrom(headers: { get(name: string): string | null }): string {
  return (
    headers.get("x-request-id") ||
    headers.get("x-vercel-id") ||
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
  ).slice(0, 100);
}
