import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { startFixture } from '../fixtures/server.js';
import { AssetStore } from '../../src/core/asset-store.js';
import { Reporter } from '../../src/core/reporter.js';
import { attachInterceptor } from '../../src/core/interceptor.js';

describe('attachInterceptor', () => {
  it('captures same-origin asset bodies into the store', async () => {
    const fx = await startFixture();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const store = new AssetStore();
    const reporter = new Reporter(fx.base, () => {});
    attachInterceptor(page, store, reporter, fx.base);

    await page.goto(fx.base + '/', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    const cssEntry = store.lookup(fx.base + '/styles.css');
    expect(cssEntry).toBeTruthy();
    const heroEntry = store.lookup(fx.base + '/hero.png');
    expect(heroEntry).toBeTruthy();

    const heroFile = store.uniqueFiles().find((f) => f.localPath === heroEntry!.localPath);
    expect(heroFile!.body.length).toBeGreaterThan(0);

    await browser.close();
    await fx.close();
  });

  it('does not store the page document itself as an asset', async () => {
    const fx = await startFixture();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const store = new AssetStore();
    const reporter = new Reporter(fx.base, () => {});
    attachInterceptor(page, store, reporter, fx.base);

    await page.goto(fx.base + '/', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    expect(store.lookup(fx.base + '/')).toBeUndefined();
    expect(store.entries().some((e) => e.localPath.endsWith('.html'))).toBe(false);

    await browser.close();
    await fx.close();
  });
});
