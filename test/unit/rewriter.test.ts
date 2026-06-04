import { describe, it, expect } from 'vitest';
import { AssetStore } from '../../src/core/asset-store.js';
import { rewriteText, rewriteAsset } from '../../src/core/rewriter.js';

function storeWith(): AssetStore {
  const s = new AssetStore();
  s.add('https://framerusercontent.com/hero.png', Buffer.from('H'), 'image/png');
  s.add('https://app.framerstatic.com/chunk.js', Buffer.from('J'), 'text/javascript');
  s.add('https://fonts.gstatic.com/inter.woff2', Buffer.from('F'), 'font/woff2');
  return s;
}

describe('rewriteText', () => {
  it('rewrites an absolute url in HTML src to a route-relative path', () => {
    const s = storeWith();
    const html = `<img src="https://framerusercontent.com/hero.png">`;
    const heroPath = s.lookup('https://framerusercontent.com/hero.png')!.localPath;
    const out = rewriteText(html, s, '/about');
    expect(out).toContain(`src="../${heroPath}"`);
  });

  it('rewrites every url in a srcset', () => {
    const s = storeWith();
    const heroPath = s.lookup('https://framerusercontent.com/hero.png')!.localPath;
    const html = `<img srcset="https://framerusercontent.com/hero.png 1024w, https://framerusercontent.com/hero.png 2048w">`;
    const out = rewriteText(html, s, '/');
    expect(out).toBe(`<img srcset="${heroPath} 1024w, ${heroPath} 2048w">`);
  });

  it('rewrites CSS url() references', () => {
    const s = storeWith();
    const fontPath = s.lookup('https://fonts.gstatic.com/inter.woff2')!.localPath;
    const css = `@font-face{src:url(https://fonts.gstatic.com/inter.woff2)}`;
    const out = rewriteText(css, s, '/');
    expect(out).toContain(`url(${fontPath})`);
  });

  it('rewrites protocol-relative urls', () => {
    const s = storeWith();
    const chunk = s.lookup('https://app.framerstatic.com/chunk.js')!.localPath;
    const html = `<script src="//app.framerstatic.com/chunk.js"></script>`;
    const out = rewriteText(html, s, '/');
    expect(out).toContain(`src="${chunk}"`);
  });

  it('leaves unknown/external urls untouched', () => {
    const s = storeWith();
    const html = `<iframe src="https://www.youtube.com/embed/abc"></iframe>`;
    const out = rewriteText(html, s, '/about');
    expect(out).toBe(html);
  });

  it('never replaces a substring of a longer url', () => {
    const s = storeWith();
    const html = `<a href="https://app.framerstatic.com/chunk.js.map">x</a>`;
    const out = rewriteText(html, s, '/');
    expect(out).toBe(html);
  });

  it('rewrites root-relative same-origin references when a site origin is given', () => {
    const s = new AssetStore();
    s.add('https://acme.framer.website/hero.png', Buffer.from('H'), 'image/png');
    const heroPath = s.lookup('https://acme.framer.website/hero.png')!.localPath;
    const html = `<img src="/hero.png">`;
    const out = rewriteText(html, s, '/about', 'https://acme.framer.website');
    expect(out).toBe(`<img src="../${heroPath}">`);
  });

  it('does not rewrite root-relative paths that belong to a different origin', () => {
    const s = new AssetStore();
    s.add('https://cdn.example.com/hero.png', Buffer.from('H'), 'image/png');
    const html = `<img src="/hero.png">`;
    const out = rewriteText(html, s, '/', 'https://acme.framer.website');
    expect(out).toBe(html);
  });

  it('leaves nav links to page documents untouched', () => {
    const s = new AssetStore();
    s.add('https://acme.framer.website/about', Buffer.from('<html>'), 'text/html');
    const html = `<a href="/about">About</a>`;
    const out = rewriteText(html, s, '/', 'https://acme.framer.website');
    expect(out).toBe(html);
  });
});

describe('rewriteAsset', () => {
  function moduleStore(): AssetStore {
    const s = new AssetStore();
    s.add('https://app.framerstatic.com/main.AAAA.mjs', Buffer.from('M'), 'text/javascript');
    s.add('https://app.framerstatic.com/react.BBBB.mjs', Buffer.from('R'), 'text/javascript');
    s.add('https://app.framerstatic.com/chunk-CCCC.mjs', Buffer.from('C'), 'text/javascript');
    s.add('https://framerusercontent.com/images/x.svg', Buffer.from('S'), 'image/svg+xml');
    return s;
  }

  it('rewrites a bare relative module import to its hashed sibling', () => {
    const s = moduleStore();
    const main = s.lookup('https://app.framerstatic.com/main.AAAA.mjs')!;
    const reactPath = s.lookup('https://app.framerstatic.com/react.BBBB.mjs')!.localPath;
    const sibling = './' + reactPath.split('/').pop();
    const js = `import{a}from"./react.BBBB.mjs";`;
    const out = rewriteAsset(js, s, main.originalUrl, main.localPath);
    expect(out).toBe(`import{a}from"${sibling}";`);
  });

  it('rewrites an absolute cross-chunk import to its hashed sibling', () => {
    const s = moduleStore();
    const main = s.lookup('https://app.framerstatic.com/main.AAAA.mjs')!;
    const chunkPath = s.lookup('https://app.framerstatic.com/chunk-CCCC.mjs')!.localPath;
    const sibling = './' + chunkPath.split('/').pop();
    const js = `import"https://app.framerstatic.com/chunk-CCCC.mjs";`;
    const out = rewriteAsset(js, s, main.originalUrl, main.localPath);
    expect(out).toBe(`import"${sibling}";`);
  });

  it('does not rewrite a relative specifier that resolves to a different directory', () => {
    const s = moduleStore();
    const js = `import"./react.BBBB.mjs";`;
    // asset served from a different path → "./react.BBBB.mjs" is NOT the stored react chunk
    const out = rewriteAsset(js, s, 'https://app.framerstatic.com/nested/other.mjs', 'assets/other.mjs');
    expect(out).toBe(js);
  });

  it('leaves image/font string URLs in module bodies absolute (they become DOM src)', () => {
    const s = moduleStore();
    const main = s.lookup('https://app.framerstatic.com/main.AAAA.mjs')!;
    const js = 'const a={src:`https://framerusercontent.com/images/x.svg`};';
    const out = rewriteAsset(js, s, main.originalUrl, main.localPath);
    expect(out).toBe(js);
  });

  it('rewrites url() targets inside a css asset', () => {
    const s = new AssetStore();
    s.add('https://fonts.gstatic.com/inter.woff2', Buffer.from('F'), 'font/woff2');
    const fontPath = s.lookup('https://fonts.gstatic.com/inter.woff2')!.localPath;
    const sibling = './' + fontPath.split('/').pop();
    const css = `@font-face{src:url(https://fonts.gstatic.com/inter.woff2)}`;
    const out = rewriteAsset(css, s, 'https://fonts.googleapis.com/css2', 'assets/abcd1234.css');
    expect(out).toBe(`@font-face{src:url(${sibling})}`);
  });
});
