import { describe, it, expect } from 'vitest';
import { normalizeRoute, isSameOrigin, relativeFromRoute } from '../../src/core/url-utils.js';

describe('normalizeRoute', () => {
  it('strips query and hash', () => {
    expect(normalizeRoute('https://a.framer.website/about?x=1#top'))
      .toBe('https://a.framer.website/about');
  });
  it('collapses trailing slash (except root)', () => {
    expect(normalizeRoute('https://a.framer.website/about/'))
      .toBe('https://a.framer.website/about');
    expect(normalizeRoute('https://a.framer.website/'))
      .toBe('https://a.framer.website/');
  });
  it('resolves relative against a base', () => {
    expect(normalizeRoute('/blog/post', 'https://a.framer.website/'))
      .toBe('https://a.framer.website/blog/post');
  });
});

describe('isSameOrigin', () => {
  it('matches same origin', () => {
    expect(isSameOrigin('https://a.framer.website/x', 'https://a.framer.website')).toBe(true);
  });
  it('rejects different origin', () => {
    expect(isSameOrigin('https://other.com/x', 'https://a.framer.website')).toBe(false);
  });
});

describe('relativeFromRoute', () => {
  it('computes path from a nested route to assets', () => {
    expect(relativeFromRoute('/blog/post-1', 'assets/x.png')).toBe('../../assets/x.png');
  });
  it('computes path from root route', () => {
    expect(relativeFromRoute('/', 'assets/x.png')).toBe('assets/x.png');
  });
  it('computes path from one-level route', () => {
    expect(relativeFromRoute('/about', 'assets/x.png')).toBe('../assets/x.png');
  });
});
