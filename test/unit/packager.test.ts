import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AssetStore } from '../../src/core/asset-store.js';
import { writeSiteTree, routeToFilePath } from '../../src/core/packager.js';

let dirs: string[] = [];
afterEach(async () => { for (const d of dirs) await rm(d, { recursive: true, force: true }); dirs = []; });

describe('routeToFilePath', () => {
  it('maps root to index.html', () => {
    expect(routeToFilePath('/')).toBe('index.html');
  });
  it('maps /about to about/index.html', () => {
    expect(routeToFilePath('/about')).toBe('about/index.html');
  });
  it('maps /blog/post-1 to blog/post-1/index.html', () => {
    expect(routeToFilePath('/blog/post-1')).toBe('blog/post-1/index.html');
  });
});

describe('writeSiteTree', () => {
  it('writes route html, assets, and report.json', async () => {
    const work = await mkdtemp(join(tmpdir(), 'frx-'));
    dirs.push(work);
    const store = new AssetStore();
    store.add('https://framerusercontent.com/a.png', Buffer.from('IMG'), 'image/png');

    const routes = [
      { route: '/', html: '<html>home</html>' },
      { route: '/about', html: '<html>about</html>' },
    ];
    const report = { sourceUrl: 'x', exportedAt: 't', routes: { discovered: 2, exported: 2, failed: [] }, assets: { localized: 1, deduped: 1, externalKept: [], failed: [] }, limits: { maxPagesHit: false } };

    await writeSiteTree(work, routes, store, report as any);

    expect((await readFile(join(work, 'index.html'), 'utf8'))).toContain('home');
    expect((await readFile(join(work, 'about', 'index.html'), 'utf8'))).toContain('about');
    const assetFiles = await readdir(join(work, 'assets'));
    expect(assetFiles).toHaveLength(1);
    const parsed = JSON.parse(await readFile(join(work, 'report.json'), 'utf8'));
    expect(parsed.routes.exported).toBe(2);
    await stat(join(work, 'README.txt'));
  });
});

import { zipDir } from '../../src/core/packager.js';
import { writeFile } from 'node:fs/promises';

describe('zipDir', () => {
  it('produces a non-empty zip file', async () => {
    const work = await mkdtemp(join(tmpdir(), 'frx-'));
    dirs.push(work);
    await writeFile(join(work, 'index.html'), '<html>x</html>');
    const zipPath = join(work, '..', `out-${process.pid}-${work.split('-').pop()}.zip`);
    await zipDir(work, zipPath);
    const s = await stat(zipPath);
    expect(s.size).toBeGreaterThan(0);
    await rm(zipPath, { force: true });
  });
});
