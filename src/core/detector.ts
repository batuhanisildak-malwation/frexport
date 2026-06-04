export interface DetectResult {
  ok: boolean;
  reason?: string;
}

const SIGNATURES = ['framerstatic.com', 'framerusercontent.com', '__framer', 'data-framer'];

export async function detectFramer(url: string): Promise<DetectResult> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'follow' });
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
