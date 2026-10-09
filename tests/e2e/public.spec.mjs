import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function activePopularIndex(page) {
  return page.locator('.popular-card').evaluateAll(cards => cards.findIndex(card => card.classList.contains('is-active')));
}

async function expectStableScroll(page, before, tolerance = 2) {
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(before - tolerance);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(before + tolerance);
}

async function clickMenuWithoutViewportAssistance(page) {
  await page.locator('#menu-toggle').evaluate(button => button.click());
}

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

test('newsletter visitor intent survives the redirect and prefills signup', async ({ page }) => {
  const email=`newsletter-e2e-${Date.now()}@example.com`;
  await page.route('**/api/newsletter', async route => {
    await route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({ok:true,requiresAuth:true,redirect:'/fr/inscription/?newsletter=1'})});
  });
  await page.route('**/api/newsletter/intent', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({intent:{email}})});
  });
  await page.goto('/fr/');
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByRole('button', { name: 'S’inscrire' }).click();
  await expect(page).toHaveURL(/\/fr\/inscription\/\?newsletter=1$/,{timeout:15_000});
  await expect(page.getByRole('textbox', { name: 'Adresse e-mail' })).toHaveValue(email);
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
  await expect(page.locator('.article-head .eyebrow')).toHaveText('Technologies');
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.locator('.article-sources a').first()).toHaveAttribute('href', /^https:\/\//);
  await expect(page.getByRole('button', { name: 'Partager' })).toBeVisible();
});

test('like and save buttons settle after an asynchronous response', async ({ page }) => {
  await page.route('**/api/content/esa-mistral-ia-spatial-europeenne', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ views: 3, likes: 2, liked: true }) });
  });
  await page.route('**/api/favorites', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/fr/articles/esa-mistral-ia-spatial-europeenne/');
  await page.evaluate(() => { document.body.dataset.auth = 'true'; });
  await page.getByRole('button', { name: 'J’aime' }).click();
  await expect(page.getByRole('button', { name: 'J’aime' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).not.toContainText('Cannot read properties');
});

test('rubric search tolerates a typing error', async ({ page }) => {
  await page.goto('/fr/intelligence-artificielle/?q=Mistaral');
  await expect(page.getByRole('link', { name: /Mistral/i }).first()).toBeVisible();
});

test('global search is available through the localized shared shell', async ({ page }) => {
  await page.goto('/fr/recherche/?q=Mistaral');
  await expect(page.getByRole('heading', { name: 'Recherche' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Rechercher' })).toHaveValue('Mistaral');
  await expect(page.getByRole('link', { name: /Mistral/i }).first()).toBeVisible();
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('scroll reveals editorial sections rather than leaving empty space', async ({ page }) => {
  await page.goto('/fr/');
  await page.locator('.latest-section').scrollIntoViewIfNeeded();
  await expect(page.locator('.latest-section')).toHaveClass(/is-visible/);
  await expect(page.locator('.latest-section .story-card').first()).toBeVisible();
});

for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1600]) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/fr/');
    await expect(page.getByRole('heading', { name: 'Les plus lus' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('rubric and article stay inside a 320px viewport',async({page})=>{
  await page.setViewportSize({width:320,height:780});
  for(const path of ['/fr/intelligence-artificielle/','/fr/articles/esa-mistral-ia-spatial-europeenne/']){
    await page.goto(path);await expect(page.locator('main h1').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
});

test('back-to-top control is visible, focused and functional on light and dark backgrounds',async({page})=>{
  for(const colorScheme of ['light','dark']){
    await page.emulateMedia({colorScheme});await page.goto('/fr/');await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    const button=page.locator('#back-top');await expect(button).toBeVisible();await button.focus();await expect(button).toBeFocused();await button.click();
    await expect.poll(()=>page.evaluate(()=>scrollY),{timeout:3000}).toBeLessThan(5);
  }
});

test('Arabic homepage has no horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/ar/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('French homepage has no serious axe errors', async ({ page }) => {
  await page.goto('/fr/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious=results.violations.filter(item => ['critical', 'serious'].includes(item.impact));
  expect(serious, serious.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`).join('\n')).toEqual([]);
});

test('advertising is completely disabled before AdSense approval', async ({ page }) => {
  await page.goto('/fr/');
  await expect(page.locator('[data-ad-slot], .ad-placement')).toHaveCount(0);
  await expect(page.locator('script[src*="googlesyndication"], script[data-tamusni-adsense]')).toHaveCount(0);
  await expect(page.locator('script[src*="ads-client"]')).toHaveCount(0);
  await expect(page.getByText(/^Publicité$/)).toHaveCount(0);
  await expect(page.getByText(/^Contenu sponsorisé$/)).toHaveCount(0);
});

test('institutional trust pages are public and linked from the footer', async ({ page }) => {
  await page.goto('/fr/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Méthodologie éditoriale' }).click();
  await expect(page).toHaveURL(/\/fr\/methodologie-editoriale\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Méthodologie éditoriale' })).toBeVisible();
  await page.goto('/fr/politique-ia/');
  await expect(page.getByRole('heading', { level: 1, name: 'Politique d’utilisation de l’IA' })).toBeVisible();
  await page.goto('/fr/contact/');
  await expect(page.getByRole('main').getByRole('link', { name: 'aetbconseil@gmail.com' })).toHaveAttribute('href', /^mailto:aetbconseil@gmail\.com/);
});

test('unknown localized URLs return a useful 404', async ({ page }) => {
  const response=await page.goto('/fr/page-qui-n-existe-pas/');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
});

test('articles expose truthful structured metadata', async ({ page }) => {
  await page.goto('/fr/articles/esa-mistral-ia-spatial-europeenne/');
  const data=await page.locator('script[type="application/ld+json"]').allTextContents();
  const author=(await page.locator('.article-meta span').first().innerText()).replace(/^Auteur\s*·\s*/, '');
  expect(data.some(value => value.includes('"@type":"Article"') && value.includes(`"author":{"@type":"Organization","name":"${author}"}`))).toBeTruthy();
  await expect(page.locator('script[data-tamusni-adsense]')).toHaveCount(0);
});

test('legal contact links have the right address and subject', async ({ page }) => {
  await page.goto('/fr/confidentialite/');
  await expect(page.getByRole('main').getByRole('link', { name: 'aetbconseil@gmail.com' })).toHaveAttribute('href', /mailto:aetbconseil@gmail\.com\?subject=TAMUSNI/);
  await page.goto('/fr/mentions-legales/');
  await expect(page.getByRole('main').getByRole('link', { name: 'aetbconseil@gmail.com' })).toHaveAttribute('href', /mailto:aetbconseil@gmail\.com\?subject=TAMUSNI/);
});

for (const locale of ['fr','ar','en','es','pt']) test(`account security pages are localized and mobile-safe in ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(`/${locale}/verifier-email/?email=test%40example.invalid`);
  await expect(page.locator('#verification-form input[name="code"]')).toHaveAttribute('maxlength','6');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  if(locale==='ar')await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await page.goto(`/${locale}/reinitialiser-mot-de-passe/?token=test-token`);
  await expect(page.locator('#reset-password-form input[name="password"]')).toHaveAttribute('minlength','6');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
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

test('desktop menu and carousel autoplay never change vertical scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/fr/');
  await page.mouse.move(0, 0);
  for (const ratio of [0.25, 0.5, 0.8]) {
    await page.evaluate(value => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * value, behavior: 'instant' }), ratio);
    const before = await page.evaluate(() => scrollY);
    await clickMenuWithoutViewportAssistance(page);
    await expectStableScroll(page, before);
    await clickMenuWithoutViewportAssistance(page);
    await expectStableScroll(page, before);
    const active = await activePopularIndex(page);
    await expect.poll(() => activePopularIndex(page), { timeout: 4_500 }).not.toBe(active);
    await expectStableScroll(page, before);
  }
});

test('mobile menu, header and carousel preserve the settled scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/fr/');
  const target = await page.evaluate(() => (document.documentElement.scrollHeight - innerHeight) * 0.6);
  await page.evaluate(value => scrollTo({ top: value + 30, behavior: 'instant' }), target);
  await page.waitForTimeout(120);
  await page.evaluate(value => scrollTo({ top: value, behavior: 'instant' }), target);
  await expect(page.locator('#site-header')).not.toHaveClass(/is-hidden/);
  const before = await page.evaluate(() => scrollY);
  await clickMenuWithoutViewportAssistance(page);
  await expectStableScroll(page, before);
  await clickMenuWithoutViewportAssistance(page);
  await expectStableScroll(page, before);
  const active = await activePopularIndex(page);
  await expect.poll(() => activePopularIndex(page), { timeout: 4_500 }).not.toBe(active);
  await expectStableScroll(page, before);
});
