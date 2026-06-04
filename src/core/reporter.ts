import type { ExportReport, ProgressEvent } from '../types.js';

type Sink = (e: ProgressEvent) => void;

export class Reporter {
  private discovered = 0;
  private exported: string[] = [];
  private failedRoutes: Array<{ route: string; reason: string }> = [];
  private externalAssets: Array<{ url: string; reason: string }> = [];
  private failedAssets: Array<{ url: string; reason: string }> = [];
  private maxPagesHit = false;

  constructor(private sourceUrl: string, private sink: Sink) {}

  emit(e: ProgressEvent): void {
    this.sink(e);
  }

  setDiscovered(n: number): void {
    this.discovered = n;
  }

  routeExported(route: string): void {
    this.exported.push(route);
  }

  routeFailed(route: string, reason: string): void {
    this.failedRoutes.push({ route, reason });
  }

  assetExternal(url: string, reason: string): void {
    this.externalAssets.push({ url, reason });
  }

  assetFailed(url: string, reason: string): void {
    this.failedAssets.push({ url, reason });
  }

  setMaxPagesHit(v: boolean): void {
    this.maxPagesHit = v;
  }

  build(
    localizedCount: number,
    dedupedCount: number,
    exportedAt = new Date().toISOString(),
  ): ExportReport {
    return {
      sourceUrl: this.sourceUrl,
      exportedAt,
      routes: {
        discovered: this.discovered,
        exported: this.exported.length,
        failed: this.failedRoutes,
      },
      assets: {
        localized: localizedCount,
        deduped: dedupedCount,
        externalKept: this.externalAssets,
        failed: this.failedAssets,
      },
      limits: { maxPagesHit: this.maxPagesHit },
    };
  }
}
