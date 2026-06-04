import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFixture } from '../fixtures/server.js';
import { runExport } from '../../src/core/pipeline.js';

let dirs: string[] = [];
afterEach(async () => { for (const d of dirs) await rm(d, { recursive: true, force: true }); dirs = []; });

describe('runExport (end-to-end)', () => {
  it('exports the fixture site to a zip with rewritten relative assets', async () => {
    const fx = await startFixture();
    const work = await mkdtemp(join(tmpdir(), 'frx-e2e-'));
    dirs.push(work);

    const { zipPath, report } = await runExport({
      url: fx.base + '/',
      workDir: work,
      concurrency: 2,
      maxPages: 50,
      onProgress: () => {},
      guard: { resolve: async (): Promise<string[]> => ['8.8.8.8'] },
    });

    expect(report.routes.exported).toBe(2);
    const siteDir = join(work, 'site');
    const home = await readFile(join(siteDir, 'index.html'), 'utf8');
    expect(home).not.toContain(fx.base + '/hero.png');
    expect(home).toMatch(/assets\/[0-9a-f]+\.png/);
    const aboutHtml = await readFile(join(siteDir, 'about', 'index.html'), 'utf8');
    expect(aboutHtml).toContain('About');
    const assets = await readdir(join(siteDir, 'assets'));
    expect(assets.length).toBeGreaterThan(0);
    const stat = await import('node:fs/promises').then((m) => m.stat(zipPath));
    expect(stat.size).toBeGreaterThan(0);

    await fx.close();
  }, 120000);
});
