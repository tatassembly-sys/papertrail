/**
 * Whether a verify or reset URL that was just issued may be returned in JSON.
 *
 * Non-production responses already include the link (log-mode mail). A local
 * `next start` is production, so the e2e server sets E2E_EXPOSE_MAIL_LINKS=1.
 * Any VERCEL_ENV (production, preview, or development) ignores that flag.
 * Never set it on a public host.
 */
export function exposeDevMailLink(): boolean {
  if (process.env.VERCEL_ENV) return false;
  if (process.env.E2E_EXPOSE_MAIL_LINKS === "1") return true;
  return process.env.NODE_ENV !== "production";
}
