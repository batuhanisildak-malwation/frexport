import { describe, it, expect } from 'vitest';
import { removeFramerBadge } from '../../src/core/badge.js';

describe('removeFramerBadge', () => {
  it('empties the badge container, dropping the framer.com link', () => {
    const html = `<html><head></head><body><div id="__framer-badge-container"><a href="https://www.framer.com" class="__framer-badge"><div data-framer-name="Backdrop"></div></a></div></body></html>`;
    const out = removeFramerBadge(html);
    expect(out).not.toContain('https://www.framer.com');
    expect(out).not.toContain('__framer-badge"');
    // the empty container itself stays (the runtime expects it to exist)
    expect(out).toContain('<div id="__framer-badge-container"></div>');
  });

  it('injects a hide-style rule into <head> so the runtime cannot re-show it', () => {
    const html = `<html><head><title>x</title></head><body><div id="__framer-badge-container"></div></body></html>`;
    const out = removeFramerBadge(html);
    expect(out).toMatch(/<style id="frexport-no-badge">[^<]*#__framer-badge-container[^<]*display:none!important/);
    expect(out.indexOf('</head>')).toBeGreaterThan(out.indexOf('frexport-no-badge'));
  });

  it('handles nested divs inside the badge without eating following markup', () => {
    const html = `<body><div id="__framer-badge-container"><a><div><div></div></div></a></div><main>keep me</main></body>`;
    const out = removeFramerBadge(html);
    expect(out).toContain('<div id="__framer-badge-container"></div>');
    expect(out).toContain('<main>keep me</main>');
  });

  it('is a no-op-safe when there is no badge container', () => {
    const html = `<html><head></head><body><main>hi</main></body></html>`;
    const out = removeFramerBadge(html);
    expect(out).toContain('<main>hi</main>');
    // still injects the guard style (harmless, future-proofs against late injection)
    expect(out).toContain('frexport-no-badge');
  });

  it('injects only once even if called on already-processed html', () => {
    const html = `<html><head></head><body></body></html>`;
    const once = removeFramerBadge(html);
    const twice = removeFramerBadge(once);
    expect(twice.match(/frexport-no-badge/g)?.length).toBe(1);
  });

  it('falls back to injecting after <html> when there is no <head>', () => {
    const html = `<html><body><div id="__framer-badge-container"><a href="https://www.framer.com"></a></div></body></html>`;
    const out = removeFramerBadge(html);
    expect(out).toContain('frexport-no-badge');
    expect(out).not.toContain('framer.com');
  });
});
