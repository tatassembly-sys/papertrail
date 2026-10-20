/**
 * Blocks SSRF targets: loopback, private, link-local, and non-http(s).
 * Host checks are synchronous. Fetch follows redirects manually and re-checks each hop.
 */

const BLOCKED_NAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (BLOCKED_NAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "0.0.0.0" || host === "::" || host === "::1") return true;
  if (/^\d+$/.test(host)) return true;
  if (/^(\d{1,3}\.){1,3}\d{1,3}$/.test(host)) {
    const parts = host.split(".").map((part) => Number(part));
    if (parts.some((n) => Number.isNaN(n) || n > 255)) return true;
    if (parts.length !== 4) return true;
    return isReservedIpv4(parts[0], parts[1]);
  }
  if (host.includes(":")) return isBlockedIpv6(host);
  return false;
}

function isReservedIpv4(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 168 || b === 0)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(host: string): boolean {
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedHostname(mapped[1]);
  return false;
}

export function isIpLiteral(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
  return host.includes(":");
}

/** Resolve a redirect Location against the current URL. Null when the hop is unsafe. */
export function nextPublicHop(current: string, location: string): string | null {
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    return null;
  }
  if (next.protocol !== "http:" && next.protocol !== "https:") return null;
  if (next.username || next.password) return null;
  if (isBlockedHostname(next.hostname)) return null;
  return next.toString();
}

export async function hostnameResolvesPublic(hostname: string): Promise<boolean> {
  if (isBlockedHostname(hostname)) return false;
  if (isIpLiteral(hostname)) return !isBlockedHostname(hostname);
  const dns = await import("node:dns/promises");
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
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
