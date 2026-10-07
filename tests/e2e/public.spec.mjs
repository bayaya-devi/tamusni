import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('French homepage, menu, rubric and article navigation', async ({ page }) => {
  await page.goto('/fr/');
  await expect(page.getByRole('heading', { name: 'Les plus lus' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Ouvrir le menu' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Ouvrir le menu' }).getByRole('link', { name: /Intelligence artificielle/ }).click();
  await expect(page).toHaveURL(/\/fr\/intelligence-artificielle\/$/);
  await expect(page.getByRole('heading', { name: 'Intelligence artificielle' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Rechercher' }).fill('NASA');
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page).toHaveURL(/q=NASA/);
});

for (const locale of ['ar', 'en', 'es', 'pt']) {
  test(`localized shell ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('.site-brand img')).toHaveAttribute('src', locale === 'ar' ? '/brand/tamusni-ar.png' : '/brand/tamusni-latin.png');
    await expect(page.locator('.tamusni-rail')).toHaveCount(0);
    await expect(page.locator('footer')).toBeVisible();
  });
}

test('login reset modal is keyboard accessible', async ({ page }) => {
  await page.goto('/fr/connexion/');
  await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Adresse e-mail' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Mot de passe oublié ?' })).toBeFocused();
});

test('signup links to readable terms of use', async ({ page }) => {
  await page.goto('/fr/inscription/');
  await page.getByRole('link', { name: 'J’accepte les conditions d’utilisation' }).click();
  await expect(page).toHaveURL(/\/fr\/conditions-utilisation\/$/);
  await expect(page.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeVisible();
});

test('article sources and actions render', async ({ page }) => {
  await page.goto('/fr/articles/royal-air-maroc-starlink-wifi-avions/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Partager' })).toBeVisible();
});

test('rubric search tolerates a typing error', async ({ page }) => {
  await page.goto('/fr/intelligence-artificielle/?q=Mistaral');
  await expect(page.getByRole('link', { name: /Mistral/i }).first()).toBeVisible();
});

test('scroll reveals editorial sections rather than leaving empty space', async ({ page }) => {
  await page.goto('/fr/');
  await page.locator('.latest-section').scrollIntoViewIfNeeded();
  await expect(page.locator('.latest-section')).toHaveClass(/is-visible/);
  await expect(page.locator('.latest-section .story-card').first()).toBeVisible();
});

for (const width of [375, 430, 768, 1024, 1280, 1440]) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/fr/');
    await expect(page.getByRole('heading', { name: 'Les plus lus' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('French homepage has no serious axe errors', async ({ page }) => {
  await page.goto('/fr/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious=results.violations.filter(item => ['critical', 'serious'].includes(item.impact));
  expect(serious, serious.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`).join('\n')).toEqual([]);
});

test('consent prevents advertising scripts until acceptance', async ({ page }) => {
  await page.goto('/fr/');
  await expect(page.getByRole('complementary', { name: 'Préférences de confidentialité' })).toBeVisible();
  await expect(page.locator('script[data-tamusni-adsense]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refuser' }).click();
  await expect(page.getByRole('complementary', { name: 'Préférences de confidentialité' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('tamusni-cookie-consent'))).toBe('necessary');
});

test('legal contact links have the right address and subject', async ({ page }) => {
  await page.goto('/fr/confidentialite/');
  await expect(page.getByRole('main').getByRole('link', { name: 'aetbconseil@gmail.com' })).toHaveAttribute('href', /mailto:aetbconseil@gmail\.com\?subject=TAMUSNI/);
  await page.goto('/fr/mentions-legales/');
  await expect(page.getByRole('main').getByRole('link', { name: 'aetbconseil@gmail.com' })).toHaveAttribute('href', /mailto:aetbconseil@gmail\.com\?subject=TAMUSNI/);
});

test('theme follows device preference and has no toggle', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/fr/');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tm-bg').trim())).toBe('#111a2e');
  await expect(page.getByRole('button', { name: /thème|theme/i })).toHaveCount(0);
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tm-bg').trim())).toBe('#f8fafc');
});

test('mobile header hides on downward scroll and returns upward', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/fr/');
  await page.evaluate(() => scrollTo(0, 900));
  await expect(page.locator('#site-header')).toHaveClass(/is-hidden/);
  await page.evaluate(() => scrollTo(0, 200));
  await expect(page.locator('#site-header')).not.toHaveClass(/is-hidden/);
});
