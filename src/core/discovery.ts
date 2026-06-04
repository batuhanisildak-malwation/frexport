import type { Browser } from 'playwright';
import { XMLParser } from 'fast-xml-parser';
import { normalizeRoute, isSameOrigin } from './url-utils.js';

interface DiscoveryResult {
  routes: string[];
  maxPagesHit: boolean;
}

async function fromSitemap(base: string): Promise<string[]> {
  try {
    const res = await fetch(new URL('/sitemap.xml', base).toString());
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = new XMLParser().parse(xml);
    const urls = parsed?.urlset?.url;
    const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
    return list
      .map((u: { loc?: string }) => u.loc)
      .filter((loc: unknown): loc is string => typeof loc === 'string')
      .filter((loc: string) => isSameOrigin(loc, base))
      .map((loc: string) => normalizeRoute(loc));
  } catch {
    return [];
  }
}

async function linksOnPage(browser: Browser, route: string, base: string): Promise<string[]> {
  const page = await browser.newPage();
  try {
    await page.goto(route, { waitUntil: 'load', timeout: 45000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const hrefs = await page.$$eval('a[href]', (els) => els.map((e) => (e as HTMLAnchorElement).href));
    return hrefs
      .filter((h) => isSameOrigin(h, base))
      .map((h) => normalizeRoute(h));
  } catch {
    return [];
  } finally {
    await page.close();
  }
}

export async function discoverRoutes(
  browser: Browser,
  base: string,
  maxPages: number,
): Promise<DiscoveryResult> {
  const seen = new Set<string>();
  const queue: string[] = [];

  const seed = normalizeRoute(base.endsWith('/') ? base : base + '/');
  queue.push(seed);
  for (const r of await fromSitemap(base)) queue.push(r);

  let maxPagesHit = false;
  const result: string[] = [];

  while (queue.length > 0) {
    const route = queue.shift()!;
    if (seen.has(route)) continue;
    if (result.length >= maxPages) { maxPagesHit = true; break; }
    seen.add(route);
    result.push(route);

    const links = await linksOnPage(browser, route, base);
    for (const link of links) {
      if (!seen.has(link)) queue.push(link);
    }
  }

  if (queue.length > 0) maxPagesHit = true;
  return { routes: result, maxPagesHit };
}
