import { test, expect } from '@playwright/test';

const credentials={
  contributor:{email:process.env.TAMUSNI_CONTRIBUTOR_EMAIL,password:process.env.TAMUSNI_CONTRIBUTOR_PASSWORD,path:'contributeur'},
  admin:{email:process.env.TAMUSNI_ADMIN_EMAIL,password:process.env.TAMUSNI_ADMIN_PASSWORD,path:'admin'}
};

async function authenticate(page,account){
  await page.goto('/fr/connexion/');
  await page.getByRole('textbox',{name:'Adresse e-mail'}).fill(account.email);
  await page.getByLabel('Mot de passe',{exact:true}).fill(account.password);
  await page.getByRole('button',{name:'Me connecter'}).click();
  await expect(page).toHaveURL(new RegExp(`/fr/${account.path}/$`));
}

for(const [role,account] of Object.entries(credentials)){
  test.describe(`${role} visual constitution`,()=>{
    test.skip(!account.email||!account.password,`${role} credentials are required`);
    for(const locale of ['fr','ar','en','es','pt']){
      test(`${locale} desktop and mobile`,async({page})=>{
        await authenticate(page,account);
        for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
          await page.setViewportSize({width,height});
          await page.goto(`/${locale}/${account.path}/`);
          await expect(page.locator('html')).toHaveAttribute('lang',locale);
          await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
          await expect(page.locator('.site-header')).toBeVisible();
          await expect(page.locator('.site-footer')).toBeVisible();
          await expect(page.locator('.tamusni-rail')).toHaveCount(0);
          const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
          expect(overflow).toBe(false);
          await page.screenshot({path:`test-results/visual-role-frontends/${role}-${locale}-${name}.png`,fullPage:true});
        }
      });
    }
  });
}
