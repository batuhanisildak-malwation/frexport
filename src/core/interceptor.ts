import type { Page, Response } from 'playwright';
import type { AssetStore } from './asset-store.js';
import type { Reporter } from './reporter.js';
import { decideLocalization } from './localizer.js';

export function attachInterceptor(
  page: Page,
  store: AssetStore,
  reporter: Reporter,
  siteUrl: string,
): void {
  page.on('response', async (response: Response) => {
    const url = response.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;

    if (response.request().resourceType() === 'document') return;

    const decision = decideLocalization(url, siteUrl);
    if (decision.kind === 'external') {
      reporter.assetExternal(url, decision.reason);
      return;
    }
    if (response.status() >= 300 && response.status() < 400) return;
    if (store.lookup(url)) return;

    const headerContentType = response.headers()['content-type'] ?? '';
    try {
      const body = await response.body();
      if (body.length > 0) {
        store.add(url, body, headerContentType);
        return;
      }
    } catch {
      // body was evicted (Chromium frees decoded image buffers); fall through to refetch
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        reporter.assetFailed(url, `status ${res.status}`);
        return;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return;
      store.add(url, buf, res.headers.get('content-type') ?? headerContentType);
    } catch (err) {
      reporter.assetFailed(url, (err as Error).message);
    }
  });
}
