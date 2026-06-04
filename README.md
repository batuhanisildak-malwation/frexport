<div align="center">

# frexport

**The _real_ Framer exporter, fr.**

Paste a published Framer URL → get a self-contained, deploy-anywhere static `.zip`.

</div>

---

Framer has no real "export to static HTML." `frexport` renders your published
site in a headless browser, captures every asset it serves, rewrites all the
URLs to relative paths, and presses the result into a static bundle you can
drop on any host — no Framer, no build step, no runtime dependency.

## Quick start

```bash
npm install
npx playwright install chromium
npm start
```

Open **http://127.0.0.1:3000**, paste a Framer URL, press **Export**, and watch
the manifest print live. When it finishes, download the zip.

> Pick another port with `PORT=8080 npm start`.

## What you get

A complete static site, ready to deploy:

- **Every page is a real `index.html`** in its own directory, so deep links and
  refreshes just work — no per-host routing config.
- **Assets localized** — images, fonts, and the Framer runtime are content-hashed
  into `assets/` and rewritten to relative paths, including the JS module graph,
  so the bundle is self-contained.
- **Interactivity preserved** — the Framer runtime ships with the export, so
  animations and effects still run.
- **A `report.json`** itemizing pages exported, assets localized and deduped,
  and anything intentionally left external (analytics, embeds).

Deploy it to Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3, or serve it
locally:

```bash
cd site && npx serve .
```

## How it works

```
detect ─▶ discover ─▶ render ─▶ localize ─▶ rewrite ─▶ press
```

1. **Detect** — confirm the URL is a published Framer site.
2. **Discover** — read `sitemap.xml`, then crawl to fill the gaps.
3. **Render** — drive each route in headless Chromium, full-scroll, and let it
   settle; a network interceptor streams every response into a content-addressed
   store with global dedup.
4. **Localize** — fetch assets referenced only in CSS that scrolling never paints.
5. **Rewrite** — repoint HTML, CSS, and JS module imports to local relative paths.
6. **Press** — lay out the directory-per-route tree and zip it.

Pages render in a small concurrency pool sharing one asset store, and progress
streams to the UI over Server-Sent Events.

## Development

```bash
npm test          # run the full suite
npm run typecheck # type-check
npm run dev       # watch mode
```

## Tech

TypeScript · Playwright (Chromium) · Fastify · Vitest

---

<div align="center">

Pressed by **Batuhan Isildak**
·
[github](https://github.com/batuhanisildak-malwation)
·
[twitter](https://twitter.com/batuhan_isildak)
·
[linkedin](https://www.linkedin.com/in/batuhan_isildak)

</div>
