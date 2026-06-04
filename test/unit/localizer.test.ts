import { describe, it, expect } from 'vitest';
import { decideLocalization } from '../../src/core/localizer.js';

const SITE = 'https://acme.framer.website';

describe('decideLocalization', () => {
  it('localizes same-origin assets', () => {
    expect(decideLocalization('https://acme.framer.website/img.png', SITE).kind).toBe('localize');
  });
  it('localizes framerusercontent', () => {
    expect(decideLocalization('https://framerusercontent.com/images/x.png', SITE).kind).toBe('localize');
  });
  it('localizes framerstatic runtime', () => {
    expect(decideLocalization('https://app.framerstatic.com/chunk.js', SITE).kind).toBe('localize');
  });
  it('localizes google fonts css and binaries', () => {
    expect(decideLocalization('https://fonts.googleapis.com/css2?family=Inter', SITE).kind).toBe('localize');
    expect(decideLocalization('https://fonts.gstatic.com/s/inter/x.woff2', SITE).kind).toBe('localize');
  });
  it('keeps youtube external', () => {
    const d = decideLocalization('https://www.youtube.com/embed/abc', SITE);
    expect(d.kind).toBe('external');
  });
  it('keeps analytics external', () => {
    expect(decideLocalization('https://www.googletagmanager.com/gtag.js', SITE).kind).toBe('external');
  });
});
