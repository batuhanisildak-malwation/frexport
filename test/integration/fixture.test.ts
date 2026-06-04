import { describe, it, expect } from 'vitest';
import { startFixture } from '../fixtures/server.js';

describe('fixture server', () => {
  it('serves the home page and sitemap with substituted base', async () => {
    const fx = await startFixture();
    const home = await fetch(fx.base + '/').then((r) => r.text());
    expect(home).toContain('framerstatic');
    const sm = await fetch(fx.base + '/sitemap.xml').then((r) => r.text());
    expect(sm).toContain(fx.base + '/about');
    await fx.close();
  });
});
