import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { startFixture } from '../fixtures/server.js';
import { AssetStore } from '../../src/core/asset-store.js';
import { Reporter } from '../../src/core/reporter.js';
import { renderAll } from '../../src/core/pool.js';

describe('renderAll', () => {
  it('renders every route and shares one asset store', async () => {
    const fx = await startFixture();
    const browser = await chromium.launch();
    const store = new AssetStore();
    const reporter = new Reporter(fx.base, () => {});
    const routes = [fx.base + '/', fx.base + '/about'];

    const results = await renderAll(browser, routes, store, reporter, fx.base, 2, { resolve: async (): Promise<string[]> => ['8.8.8.8'] });

    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.map((r) => r.route).sort()).toEqual(routes.sort());
    expect(store.lookup(fx.base + '/hero.png')).toBeTruthy();

    await browser.close();
    await fx.close();
  });
});
