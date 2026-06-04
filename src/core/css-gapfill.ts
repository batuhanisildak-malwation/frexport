import type { AssetStore } from './asset-store.js';
import { decideLocalization } from './localizer.js';

const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

export function extractCssUrls(css: string, cssUrl: string): string[] {
  const out: string[] = [];
  for (const match of css.matchAll(URL_RE)) {
    const raw = match[2]!.trim();
    if (raw.startsWith('data:')) continue;
    try {
      out.push(new URL(raw, cssUrl).toString());
    } catch {
      // skip unparseable
    }
  }
  return out;
}

export async function gapFillCss(store: AssetStore, siteUrl: string): Promise<void> {
  const cssEntries = store.entries().filter((e) => e.localPath.endsWith('.css'));
  for (const cssEntry of cssEntries) {
    const file = store.uniqueFiles().find((f) => f.localPath === cssEntry.localPath);
    if (!file) continue;
    const urls = extractCssUrls(file.body.toString('utf8'), cssEntry.originalUrl);
    for (const url of urls) {
      if (store.lookup(url)) continue;
      if (decideLocalization(url, siteUrl).kind !== 'localize') continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        store.add(url, buf, res.headers.get('content-type') ?? '');
      } catch {
        // non-fatal
      }
    }
  }
}
