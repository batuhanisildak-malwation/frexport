import { guardedFetch } from '../server/url-guard.js';
import type { GuardOptions } from '../server/url-guard.js';

export interface DetectResult {
  ok: boolean;
  reason?: string;
}

const SIGNATURES = ['framerstatic.com', 'framerusercontent.com', '__framer', 'data-framer'];

export async function detectFramer(url: string, guard?: GuardOptions): Promise<DetectResult> {
  let res: Response;
  try {
    res = await guardedFetch(url, {}, guard);
  } catch (err) {
    return { ok: false, reason: `unreachable: ${(err as Error).message}` };
  }
  if (!res.ok) return { ok: false, reason: `status ${res.status}` };
  const html = await res.text();
  const hit = SIGNATURES.some((s) => html.includes(s));
  return hit
    ? { ok: true }
    : { ok: false, reason: 'no Framer signature found (not a Framer site)' };
}
