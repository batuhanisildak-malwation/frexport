import type { Browser } from 'playwright';
import type { AssetStore } from './asset-store.js';
import type { Reporter } from './reporter.js';
import { attachInterceptor } from './interceptor.js';
import { renderRoute } from './renderer.js';
import { makeRouteGuard } from '../server/url-guard.js';
import type { GuardOptions } from '../server/url-guard.js';

export interface RenderedRoute {
  route: string;
  html: string;
  ok: boolean;
  reason?: string;
}

async function worker(
  browser: Browser,
  route: string,
  store: AssetStore,
  reporter: Reporter,
  siteUrl: string,
  guard?: GuardOptions,
): Promise<RenderedRoute> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/*', makeRouteGuard(guard));
  attachInterceptor(page, store, reporter, siteUrl, guard);
  try {
    const html = await renderRoute(page, route);
    reporter.routeExported(route);
    return { route, html, ok: true };
  } catch (err) {
    const reason = (err as Error).message;
    reporter.routeFailed(route, reason);
    return { route, html: '', ok: false, reason };
  } finally {
    await context.close();
  }
}

export async function renderAll(
  browser: Browser,
  routes: string[],
  store: AssetStore,
  reporter: Reporter,
  siteUrl: string,
  concurrency: number,
  guard?: GuardOptions,
): Promise<RenderedRoute[]> {
  const results: RenderedRoute[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < routes.length) {
      const i = index++;
      const route = routes[i]!;
      reporter.emit({ phase: 'render', route, index: i + 1, total: routes.length });
      results[i] = await worker(browser, route, store, reporter, siteUrl, guard);
    }
  }

  const lanes = Array.from({ length: Math.min(concurrency, routes.length) }, () => next());
  await Promise.all(lanes);
  return results;
}
