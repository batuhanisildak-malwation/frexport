export type LocalizeDecision =
  | { kind: 'localize' }
  | { kind: 'external'; reason: string };

export interface AssetEntry {
  originalUrl: string;
  localPath: string;
  hash: string;
  contentType: string;
}

export interface RouteResult {
  route: string;
  outputHtmlPath: string;
  ok: boolean;
  reason?: string;
}

export interface ExportReport {
  sourceUrl: string;
  exportedAt: string;
  routes: {
    discovered: number;
    exported: number;
    failed: Array<{ route: string; reason: string }>;
  };
  assets: {
    localized: number;
    deduped: number;
    externalKept: Array<{ url: string; reason: string }>;
    failed: Array<{ url: string; reason: string }>;
  };
  limits: { maxPagesHit: boolean };
}

export type ProgressEvent =
  | { phase: 'queued'; position: number; message: string }
  | { phase: 'detect'; message: string }
  | { phase: 'discover'; found: number; message: string }
  | { phase: 'render'; route: string; index: number; total: number }
  | { phase: 'assets'; count: number }
  | { phase: 'package'; message: string }
  | { phase: 'done'; downloadUrl: string; report: ExportReport }
  | { phase: 'error'; message: string };
