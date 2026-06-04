import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/server/server.js';
import { loadConfig } from '../../src/config.js';
import type { ExportOptions, ExportResult } from '../../src/core/pipeline.js';

// a fake export that completes instantly without a browser
const fakeExport = async (opts: ExportOptions): Promise<ExportResult> => {
  opts.onProgress({ phase: 'detect', message: 'fake' });
  return {
    zipPath: '/tmp/fake.zip',
    report: {
      sourceUrl: opts.url, exportedAt: 'now',
      routes: { discovered: 1, exported: 1, failed: [] },
      assets: { localized: 0, deduped: 0, externalKept: [], failed: [] },
      limits: { maxPagesHit: false },
    },
  };
};

function makeApp(overrides: Record<string, string> = {}) {
  const config = loadConfig({ NODE_ENV: 'test', ...overrides });
  return buildServer({ config, runExport: fakeExport });
}

describe('server hardening', () => {
  it('returns 400 when url is missing', async () => {
    const app = makeApp();
    const res = await app.inject({ method: 'POST', url: '/export', payload: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a private/blocked url with 400', async () => {
    const app = makeApp();
    const res = await app.inject({ method: 'POST', url: '/export', payload: { url: 'http://127.0.0.1/' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/blocked|private/i);
    await app.close();
  });

  it('accepts a public url and returns a job id', async () => {
    const app = makeApp();
    const res = await app.inject({
      method: 'POST', url: '/export',
      payload: { url: 'https://example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().jobId).toBe('string');
    await app.close();
  });

  it('serves /healthz', async () => {
    const app = makeApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rate-limits beyond RATE_MAX from one IP', async () => {
    const app = makeApp({ RATE_MAX: '2', RATE_WINDOW: '1m' });
    const hit = () => app.inject({
      method: 'POST', url: '/export',
      headers: { 'x-forwarded-for': '203.0.113.7' },
      payload: { url: 'https://example.com' },
    });
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(429);
    await app.close();
  });
});
