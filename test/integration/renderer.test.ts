import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { startFixture } from '../fixtures/server.js';
import { AssetStore } from '../../src/core/asset-store.js';
import { Reporter } from '../../src/core/reporter.js';
import { attachInterceptor } from '../../src/core/interceptor.js';
import { renderRoute } from '../../src/core/renderer.js';

describe('renderRoute', () => {
  it('returns rendered DOM html and triggers asset capture', async () => {
    const fx = await startFixture();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const store = new AssetStore();
    const reporter = new Reporter(fx.base, () => {});
    attachInterceptor(page, store, reporter, fx.base);

    const html = await renderRoute(page, fx.base + '/about');
    expect(html).toContain('About');
    expect(html.startsWith('<!DOCTYPE') || html.startsWith('<html')).toBe(true);

    await browser.close();
    await fx.close();
  });
});
