import { describe, it, expect, beforeEach } from 'vitest';
import { AssetStore } from '../../src/core/asset-store.js';

describe('AssetStore', () => {
  let store: AssetStore;
  beforeEach(() => { store = new AssetStore(); });

  it('stores an asset and returns a local path under assets/', () => {
    const entry = store.add('https://framerusercontent.com/a.png', Buffer.from('PNGDATA'), 'image/png');
    expect(entry.localPath).toMatch(/^assets\/[0-9a-f]+\.png$/);
    expect(store.lookup('https://framerusercontent.com/a.png')?.localPath).toBe(entry.localPath);
  });

  it('dedupes identical content across different urls (same hash, counted as dedup)', () => {
    const e1 = store.add('https://framerusercontent.com/a.png', Buffer.from('SAME'), 'image/png');
    const e2 = store.add('https://framerusercontent.com/b.png', Buffer.from('SAME'), 'image/png');
    expect(e1.hash).toBe(e2.hash);
    expect(e1.localPath).toBe(e2.localPath);
    expect(store.dedupedCount()).toBe(1);
    expect(store.uniqueFiles().length).toBe(1);
  });

  it('infers extension from content-type when url has none', () => {
    const entry = store.add('https://app.framerstatic.com/chunk', Buffer.from('x'), 'text/javascript');
    expect(entry.localPath).toMatch(/\.js$/);
  });

  it('returns all url->path map entries', () => {
    store.add('https://framerusercontent.com/a.png', Buffer.from('A'), 'image/png');
    expect(store.size()).toBe(1);
  });
});
