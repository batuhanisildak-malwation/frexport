import { describe, it, expect } from 'vitest';
import { Reporter } from '../../src/core/reporter.js';

describe('Reporter', () => {
  it('builds a report from recorded events', () => {
    const r = new Reporter('https://acme.framer.website', () => {});
    r.setDiscovered(3);
    r.routeExported('/');
    r.routeExported('/about');
    r.routeFailed('/broken', 'render timeout');
    r.assetExternal('https://youtube.com/x', 'live third-party');
    r.assetFailed('https://cdn/x.png', '404');
    r.setMaxPagesHit(false);

    const report = r.build(2, 1);
    expect(report.routes.discovered).toBe(3);
    expect(report.routes.exported).toBe(2);
    expect(report.routes.failed).toEqual([{ route: '/broken', reason: 'render timeout' }]);
    expect(report.assets.localized).toBe(2);
    expect(report.assets.deduped).toBe(1);
    expect(report.assets.externalKept).toHaveLength(1);
    expect(report.assets.failed).toHaveLength(1);
    expect(report.sourceUrl).toBe('https://acme.framer.website');
    expect(typeof report.exportedAt).toBe('string');
  });

  it('forwards progress events to the sink', () => {
    const events: string[] = [];
    const r = new Reporter('https://x', (e) => events.push(e.phase));
    r.emit({ phase: 'detect', message: 'ok' });
    expect(events).toEqual(['detect']);
  });
});
