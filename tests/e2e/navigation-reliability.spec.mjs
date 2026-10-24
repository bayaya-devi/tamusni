import { test, expect } from '@playwright/test';

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function followAndReturn(page, locator, originPath) {
  const href = await locator.getAttribute('href');
  expect(href).toBeTruthy();
  const target = new URL(href, page.url());
  await locator.click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegex(target.pathname)}$`));
  await expect(page.locator('main h1').first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${escapeRegex(originPath)}$`));
}

test.describe('reliable public navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test('hero, popular stories and latest cards retain their own destinations after repeated returns', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/fr/');
    // Freeze both editorial carousels so each asserted destination is stable.
    await page.locator('[data-pause="hero"]').click();
    await page.locator('[data-pause="popular"]').click();

    // 18 editorial navigation transitions here, combined with the menu,
    // footer, language and mobile cases below: 24 deterministic transitions.
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await followAndReturn(page, page.locator('.hero-slide.is-current .hero-card'), '/fr/');
      await followAndReturn(page, page.locator('.popular-card a').nth(1), '/fr/');
      await followAndReturn(page, page.locator('.latest-section .story-card a').first(), '/fr/');
    }
  });

  test('menu, brand and footer use their own native destinations', async ({ page }) => {
    await page.goto('/fr/');
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    const intelligence = page.getByRole('navigation', { name: 'Ouvrir le menu' }).getByRole('link', { name: /Intelligence artificielle/ });
    await intelligence.click();
    await expect(page).toHaveURL(/\/fr\/intelligence-artificielle\/$/);
    await page.locator('.site-brand').click();
    await expect(page).toHaveURL(/\/fr\/$/);
    const footer = page.getByRole('contentinfo');
    await footer.getByRole('link', { name: 'Méthodologie éditoriale' }).click();
    await expect(page).toHaveURL(/\/fr\/methodologie-editoriale\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/fr\/$/);
  });

  test('language change keeps the same article slug and an unknown article remains a 404', async ({ page }) => {
    const articlePath = '/fr/articles/esa-mistral-ia-spatial-europeenne/';
    await page.goto(articlePath);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.locator('#language').selectOption('ar');
    await expect(page).toHaveURL(/\/ar\/articles\/esa-mistral-ia-spatial-europeenne\/$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.locator('#language').selectOption('fr');
    await expect(page).toHaveURL(new RegExp(`${escapeRegex(articlePath)}$`));

    const response = await page.goto('/fr/articles/article-introuvable-navigation/');
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(/\/fr\/articles\/article-introuvable-navigation\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
  });

  for (const width of [320, 360, 390, 412]) {
    test(`mobile ${width}px keeps a card destination stable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/fr/');
      await followAndReturn(page, page.locator('.latest-section .story-card a').first(), '/fr/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
