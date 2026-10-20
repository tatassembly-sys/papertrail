import { lookup } from "dns/promises";
import { isBlockedHostname, isIpLiteral, nextPublicHop } from "./url-safety";

/** Server-only. Do not import this from a client component. */
export async function hostnameResolvesPublic(hostname: string): Promise<boolean> {
  if (isBlockedHostname(hostname)) return false;
  if (isIpLiteral(hostname)) return !isBlockedHostname(hostname);
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((record) => !isBlockedHostname(record.address));
  } catch {
    return false;
  }
}

/**
 * GET/POST an http(s) URL. Redirects are not followed by fetch; each Location
 * is checked again so a public URL cannot bounce to a private address.
 */
export async function fetchPublicHttp(url: string, init: RequestInit = {}): Promise<Response> {
  let current = nextPublicHop("https://example.invalid/", url);
  if (!current) throw new Error("Blocked URL.");
  for (let hop = 0; hop < 4; hop++) {
    const parsed = new URL(current);
    if (!(await hostnameResolvesPublic(parsed.hostname))) {
      throw new Error("Blocked URL.");
    }
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location) return res;
    const next = nextPublicHop(current, location);
    if (!next) throw new Error("Blocked redirect.");
    current = next;
  }
  throw new Error("Too many redirects.");
}
