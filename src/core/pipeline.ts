import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { AssetStore } from './asset-store.js';
import { Reporter } from './reporter.js';
import { detectFramer } from './detector.js';
import { discoverRoutes } from './discovery.js';
import { renderAll } from './pool.js';
import { rewriteText, rewriteAsset } from './rewriter.js';
import { gapFillCss } from './css-gapfill.js';
import { writeSiteTree, zipDir, type RouteHtml } from './packager.js';
import type { ExportReport, ProgressEvent } from '../types.js';

export interface ExportOptions {
  url: string;
  workDir: string;
  concurrency: number;
  maxPages: number;
  onProgress: (e: ProgressEvent) => void;
}

export interface ExportResult {
  zipPath: string;
  report: ExportReport;
}

function routePathOnly(routeUrl: string): string {
  return new URL(routeUrl).pathname || '/';
}

export async function runExport(opts: ExportOptions): Promise<ExportResult> {
  const { url, workDir, concurrency, maxPages, onProgress } = opts;
  const reporter = new Reporter(url, onProgress);

  reporter.emit({ phase: 'detect', message: 'Checking if this is a Framer site…' });
  const detection = await detectFramer(url);
  if (!detection.ok) {
    throw new Error(detection.reason ?? 'Not a Framer site');
  }

  const browser = await chromium.launch();
  try {
    const base = new URL(url).origin;
    const { routes, maxPagesHit } = await discoverRoutes(browser, base, maxPages);
    reporter.setDiscovered(routes.length);
    reporter.setMaxPagesHit(maxPagesHit);
    reporter.emit({ phase: 'discover', found: routes.length, message: `Found ${routes.length} routes` });

    const store = new AssetStore();
    const rendered = await renderAll(browser, routes, store, reporter, base, concurrency);

    await gapFillCss(store, base);

    for (const asset of store.textAssets()) {
      const rewritten = rewriteAsset(asset.body.toString('utf8'), store, asset.originalUrl, asset.localPath);
      store.setFileBody(asset.localPath, Buffer.from(rewritten, 'utf8'));
    }

    reporter.emit({ phase: 'assets', count: store.dedupedCount() });

    const okRoutes = rendered.filter((r) => r.ok);
    const routeHtml: RouteHtml[] = okRoutes.map((r) => ({
      route: routePathOnly(r.route),
      html: rewriteText(r.html, store, routePathOnly(r.route), base),
    }));

    reporter.emit({ phase: 'package', message: 'Building zip…' });
    const siteDir = join(workDir, 'site');
    await mkdir(siteDir, { recursive: true });
    const report = reporter.build(store.size(), store.dedupedCount());
    await writeSiteTree(siteDir, routeHtml, store, report);

    const zipPath = join(workDir, 'site.zip');
    await zipDir(siteDir, zipPath);

    return { zipPath, report };
  } finally {
    await browser.close();
  }
}
