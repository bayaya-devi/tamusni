import { test, expect } from '@playwright/test';

const accounts = {
  user: { email: process.env.TAMUSNI_USER_EMAIL, password: process.env.TAMUSNI_USER_PASSWORD, destination: /\/fr\/mon-espace\/$/ },
  contributor: { email: process.env.TAMUSNI_CONTRIBUTOR_EMAIL, password: process.env.TAMUSNI_CONTRIBUTOR_PASSWORD, destination: /\/fr\/contributeur\/$/ },
  admin: { email: process.env.TAMUSNI_ADMIN_EMAIL, password: process.env.TAMUSNI_ADMIN_PASSWORD, destination: /\/fr\/admin\/$/ }
};

async function login(page, account) {
  await page.goto('/fr/connexion/');
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(account.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Me connecter' }).click();
  await expect(page).toHaveURL(account.destination);
}

test('private role suite has explicit credentials', () => {
  const missing = Object.entries(accounts).flatMap(([role, value]) => value.email && value.password ? [] : [role]);
  test.skip(missing.length > 0, `Credentials not supplied for: ${missing.join(', ')}`);
});

test('guest cannot enter administrator or contributor areas', async ({ page }) => {
  await page.goto('/admin/');
  await expect(page).toHaveURL(/\/(?:fr|ar|en|es|pt)\/connexion\//);
  await page.goto('/contributeur/');
  await expect(page).toHaveURL(/\/(?:fr|ar|en|es|pt)\/connexion\//);
});

for (const [role, account] of Object.entries(accounts)) {
  test(`${role} account authenticates and reaches its intended area`, async ({ page }) => {
    test.skip(!account.email || !account.password, `${role} credentials were not supplied`);
    await login(page, account);
    const session = await page.request.get('/api/auth/session');
    expect(session.status()).toBe(200);
    const payload = await session.json();
    expect(payload.authenticated).toBe(true);
    expect(payload.user.email).toBe(account.email);
    expect(payload.user.role).toBe(role === 'user' ? 'USER' : role.toUpperCase());

    if (role === 'user') {
      const admin = await page.request.get('/api/admin/content');
      expect(admin.status()).toBe(403);
      const contributor = await page.request.get('/api/contributor/submissions');
      expect(contributor.status()).toBe(403);
    }
    if (role === 'contributor') {
      const admin = await page.request.get('/api/admin/content');
      expect(admin.status()).toBe(403);
    }
  });
}
