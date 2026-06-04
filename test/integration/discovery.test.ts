import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { startFixture } from '../fixtures/server.js';
import { discoverRoutes } from '../../src/core/discovery.js';

describe('discoverRoutes', () => {
  it('finds routes from sitemap and crawl', async () => {
    const fx = await startFixture();
    const browser = await chromium.launch();
    const { routes, maxPagesHit } = await discoverRoutes(browser, fx.base, 200, { resolve: async (): Promise<string[]> => ['8.8.8.8'] });

    expect(routes).toContain(fx.base + '/');
    expect(routes).toContain(fx.base + '/about');
    expect(maxPagesHit).toBe(false);
    expect(new Set(routes).size).toBe(routes.length);

    await browser.close();
    await fx.close();
  });

  it('respects maxPages cap', async () => {
    const fx = await startFixture();
    const browser = await chromium.launch();
    const { routes, maxPagesHit } = await discoverRoutes(browser, fx.base, 1, { resolve: async (): Promise<string[]> => ['8.8.8.8'] });
    expect(routes.length).toBeLessThanOrEqual(1);
    expect(maxPagesHit).toBe(true);
    await browser.close();
    await fx.close();
  });
});
