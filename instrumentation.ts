// Next.js instrumentation hook. Sentry starts only when SENTRY_DSN is set (M7.1).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN?.trim()) {
    const { initSentry } = await import("./lib/sentry");
    await initSentry();
  }
}

export async function onRequestError(err: unknown, request: { path?: string; method?: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN?.trim()) return;
  const { captureError } = await import("./lib/sentry");
  captureError(err, { route: request?.path, method: request?.method });
}
