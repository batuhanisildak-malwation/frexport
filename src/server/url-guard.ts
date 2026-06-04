import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Route, Request as PwRequest } from 'playwright';

export interface GuardOptions {
  // Address-oracle override. PRODUCTION MUST NOT set this — when omitted, literal
  // private IPs are hard-blocked and hostnames go through real DNS. It exists as a
  // test seam: when provided, it resolves every host (including IP literals) so
  // integration tests can point the guard at a loopback fixture.
  resolve?: (host: string) => Promise<string[]>;
}

async function defaultResolve(host: string): Promise<string[]> {
  const records = await lookup(host, { all: true });
  return records.map((r) => r.address);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → treat as unsafe
  const inRange = (cidr: number, bits: number): boolean => (n >>> (32 - bits)) === (cidr >>> (32 - bits));
  return (
    inRange(ipv4ToInt('0.0.0.0')!, 8) ||
    inRange(ipv4ToInt('10.0.0.0')!, 8) ||
    inRange(ipv4ToInt('127.0.0.0')!, 8) ||
    inRange(ipv4ToInt('169.254.0.0')!, 16) ||
    inRange(ipv4ToInt('172.16.0.0')!, 12) ||
    inRange(ipv4ToInt('192.168.0.0')!, 16) ||
    inRange(ipv4ToInt('100.64.0.0')!, 10) // CGNAT
  );
}

export function isPrivateAddress(addr: string): boolean {
  const v = isIP(addr);
  if (v === 4) return isPrivateIpv4(addr);
  if (v === 6) {
    const lower = addr.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique local
    if (lower.startsWith('fe80')) return true;                          // fe80::/10 link-local

    // IPv4-mapped (::ffff:a.b.c.d), in dotted-decimal OR hex-word form (::ffff:ab0c:d)
    const dotted = lower.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (dotted) return isPrivateIpv4(dotted[1]!);
    const hex = lower.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1]!, 16);
      const lo = parseInt(hex[2]!, 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateIpv4(v4);
    }
    return false;
  }
  return true; // not a valid IP → unsafe
}

export async function assertPublicUrl(url: string, opts: GuardOptions = {}): Promise<void> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`blocked: unparseable url`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`blocked: scheme ${u.protocol} not allowed`);
  }
  if (u.username || u.password) {
    throw new Error(`blocked: credentials in url not allowed`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // Default (production) path: IP literals are classified directly, never resolved.
  if (isIP(host) && opts.resolve === undefined) {
    if (isPrivateAddress(host)) throw new Error(`blocked: private address ${host}`);
    return;
  }
  const resolve = opts.resolve ?? defaultResolve;
  let addrs: string[];
  try {
    addrs = await resolve(host);
  } catch {
    throw new Error(`blocked: dns resolution failed for ${host}`);
  }
  if (addrs.length === 0) throw new Error(`blocked: no addresses for ${host}`);
  for (const a of addrs) {
    if (isPrivateAddress(a)) throw new Error(`blocked: ${host} resolves to private ${a}`);
  }
}

export async function guardedFetch(
  url: string,
  init: RequestInit = {},
  opts: GuardOptions = {},
  maxHops = 5,
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertPublicUrl(current, opts);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('blocked: too many redirects');
}

export function makeRouteGuard(
  opts: GuardOptions = {},
): (route: Route, request: PwRequest) => Promise<void> {
  return async (route: Route, request: PwRequest): Promise<void> => {
    try {
      await assertPublicUrl(request.url(), opts);
      await route.continue();
    } catch {
      await route.abort('blockedbyclient');
    }
  };
}
