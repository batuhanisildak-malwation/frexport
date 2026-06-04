import { describe, it, expect } from 'vitest';
import { extractCssUrls } from '../../src/core/css-gapfill.js';

describe('extractCssUrls', () => {
  it('extracts absolute and relative url() targets resolved against the css url', () => {
    const css = `@font-face{src:url(https://fonts.gstatic.com/a.woff2)} .x{background:url("/bg.png")}`;
    const urls = extractCssUrls(css, 'https://acme.framer.website/styles.css');
    expect(urls).toContain('https://fonts.gstatic.com/a.woff2');
    expect(urls).toContain('https://acme.framer.website/bg.png');
  });

  it('ignores data uris', () => {
    const css = `.x{background:url(data:image/png;base64,AAAA)}`;
    expect(extractCssUrls(css, 'https://a/styles.css')).toHaveLength(0);
  });
});
