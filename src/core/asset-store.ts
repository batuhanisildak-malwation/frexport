import { createHash } from 'node:crypto';
import type { AssetEntry } from '../types.js';

const EXT_BY_TYPE: Record<string, string> = {
  'text/javascript': 'js',
  'application/javascript': 'js',
  'text/css': 'css',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'application/font-woff2': 'woff2',
  'text/html': 'html',
};

function extFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-zA-Z0-9]{1,5})$/);
    return m ? m[1]!.toLowerCase() : null;
  } catch {
    return null;
  }
}

function extFor(url: string, contentType: string): string {
  const fromUrl = extFromUrl(url);
  if (fromUrl) return fromUrl;
  const base = contentType.split(';')[0]!.trim().toLowerCase();
  return EXT_BY_TYPE[base] ?? 'bin';
}

export class AssetStore {
  private urlMap = new Map<string, AssetEntry>();
  private files = new Map<string, { hash: string; ext: string; body: Buffer }>();
  private dedupHits = 0;

  add(url: string, body: Buffer, contentType: string): AssetEntry {
    const existing = this.urlMap.get(url);
    if (existing) return existing;

    const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
    const ext = extFor(url, contentType);
    const localPath = `assets/${hash}.${ext}`;

    if (this.files.has(localPath)) {
      this.dedupHits++;
    } else {
      this.files.set(localPath, { hash, ext, body });
    }

    const entry: AssetEntry = { originalUrl: url, localPath, hash, contentType };
    this.urlMap.set(url, entry);
    return entry;
  }

  lookup(url: string): AssetEntry | undefined {
    return this.urlMap.get(url);
  }

  entries(): AssetEntry[] {
    return [...this.urlMap.values()];
  }

  uniqueFiles(): Array<{ localPath: string; body: Buffer }> {
    return [...this.files.entries()].map(([localPath, v]) => ({ localPath, body: v.body }));
  }

  textAssets(): Array<{ localPath: string; originalUrl: string; body: Buffer }> {
    const result: Array<{ localPath: string; originalUrl: string; body: Buffer }> = [];
    const seen = new Set<string>();
    for (const entry of this.urlMap.values()) {
      const ext = entry.localPath.slice(entry.localPath.lastIndexOf('.') + 1);
      if (ext !== 'js' && ext !== 'mjs' && ext !== 'css') continue;
      if (seen.has(entry.localPath)) continue;
      const file = this.files.get(entry.localPath);
      if (!file) continue;
      seen.add(entry.localPath);
      result.push({ localPath: entry.localPath, originalUrl: entry.originalUrl, body: file.body });
    }
    return result;
  }

  setFileBody(localPath: string, body: Buffer): void {
    const file = this.files.get(localPath);
    if (file) file.body = body;
  }

  size(): number { return this.urlMap.size; }
  dedupedCount(): number { return this.files.size; }
  dedupHitCount(): number { return this.dedupHits; }
}
