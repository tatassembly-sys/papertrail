/**
 * Server-side Sentry (M7.1), gated on SENTRY_DSN.
 * With SENTRY_DSN unset nothing is imported or initialised and no network
 * call happens. Events are scrubbed of PII (user, cookies, headers, emails,
 * tokens) before they leave the process.
 */
import { redact, redactString, setErrorReporter } from "./log";

type SentryLike = {
  init(options: Record<string, unknown>): unknown;
  captureException(err: unknown, hint?: unknown): unknown;
};

let sentry: SentryLike | null = null;

export function sentryDsn(env: NodeJS.ProcessEnv = process.env): string | null {
  const dsn = env.SENTRY_DSN?.trim();
  return dsn ? dsn : null;
}

export function isSentryEnabled(): boolean {
  return sentry !== null;
}

/** Strip PII from a Sentry event. Exported for tests. */
export function scrubEvent<T extends Record<string, unknown>>(event: T): T {
  const e = { ...event } as Record<string, unknown>;
  delete e.user;
  delete e.server_name;
  if (e.request && typeof e.request === "object") {
    const req = { ...(e.request as Record<string, unknown>) };
    delete req.cookies;
    delete req.headers;
    delete req.data;
    if (typeof req.query_string === "string") req.query_string = redactString(req.query_string);
    if (typeof req.url === "string") req.url = redactString(req.url);
    e.request = req;
  }
  if (typeof e.message === "string") e.message = redactString(e.message);
  if (e.extra) e.extra = redact(e.extra);
  if (e.contexts) e.contexts = redact(e.contexts);
  const exc = e.exception as { values?: { value?: string }[] } | undefined;
  if (exc?.values) {
    e.exception = {
      ...exc,
      values: exc.values.map((v) => ({ ...v, value: v.value ? redactString(v.value) : v.value })),
    };
  }
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = (e.breadcrumbs as Record<string, unknown>[]).map((b) => ({
      ...b,
      message: typeof b.message === "string" ? redactString(b.message) : b.message,
      data: b.data ? redact(b.data) : b.data,
    }));
  }
  return e as T;
}

/**
 * Initialise Sentry when SENTRY_DSN is set. Returns true when enabled.
 * `load` is injectable for tests.
 */
export async function initSentry(
  env: NodeJS.ProcessEnv = process.env,
  load: () => Promise<SentryLike> = () => import("@sentry/nextjs") as Promise<SentryLike>
): Promise<boolean> {
  const dsn = sentryDsn(env);
  if (!dsn) return false;
  if (sentry) return true;
  const mod = await load();
  mod.init({
    dsn,
    environment: env.VERCEL_ENV || env.NODE_ENV,
    release: env.VERCEL_GIT_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE || 0),
    beforeSend: (event: Record<string, unknown>) => scrubEvent(event),
    beforeBreadcrumb: (crumb: Record<string, unknown>) => scrubEvent({ breadcrumbs: [crumb] }).breadcrumbs?.[0],
  });
  sentry = mod;
  setErrorReporter((err, ctx) => {
    try {
      sentry?.captureException(err, { extra: redact(ctx ?? {}) });
    } catch {
      /* never throw from reporting */
    }
  });
  return true;
}

/** Report an error; a no-op unless Sentry is enabled. */
export function captureError(err: unknown, ctx?: Record<string, unknown>): void {
  if (!sentry) return;
  try {
    sentry.captureException(err, { extra: redact(ctx ?? {}) });
  } catch {
    /* ignore */
  }
}

/** Test hook. */
export function resetSentryForTests(): void {
  sentry = null;
  setErrorReporter();
}
