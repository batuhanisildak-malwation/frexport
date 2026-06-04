import type { Page } from 'playwright';

const SETTLE_MS = 400;

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  });
}

export async function renderRoute(page: Page, route: string): Promise<string> {
  await page.goto(route, { waitUntil: 'load', timeout: 45000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await autoScroll(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  return page.content();
}
