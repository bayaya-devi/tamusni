import { test, expect } from '@playwright/test';

const contributor={email:process.env.TAMUSNI_CONTRIBUTOR_EMAIL,password:process.env.TAMUSNI_CONTRIBUTOR_PASSWORD};
const admin={email:process.env.TAMUSNI_ADMIN_EMAIL,password:process.env.TAMUSNI_ADMIN_PASSWORD};
const user={email:process.env.TAMUSNI_USER_EMAIL,password:process.env.TAMUSNI_USER_PASSWORD};
const jpeg='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
const body='Ce contenu est un test technique clairement identifié. Il ne constitue pas une actualité et sert uniquement à vérifier le circuit éditorial TAMUSNI. '.repeat(9);
const excerpt='Test technique contrôlé du circuit contributeur et administrateur, sans information présentée comme une actualité.';

async function login(page,account){
  await page.goto('/fr/connexion/');
  await page.getByRole('textbox',{name:'Adresse e-mail'}).fill(account.email);
  await page.getByLabel('Mot de passe',{exact:true}).fill(account.password);
  await page.getByRole('button',{name:'Me connecter'}).click();
  await expect(page).not.toHaveURL(/connexion/);
}

async function json(response){expect(response.ok(),await response.text()).toBe(true);return response.json()}

test('controlled contributor-to-admin workflow is complete and cleaned up',async({browser})=>{
  test.skip(!contributor.email||!contributor.password||!admin.email||!admin.password,'Role credentials are required');
  const contributorContext=await browser.newContext({baseURL:process.env.TAMUSNI_TEST_URL||'http://127.0.0.1:8788'}),contributorPage=await contributorContext.newPage();
  const adminContext=await browser.newContext({baseURL:process.env.TAMUSNI_TEST_URL||'http://127.0.0.1:8788'}),adminPage=await adminContext.newPage();
  await login(contributorPage,contributor);await login(adminPage,admin);
  const createdSubmissions=[],createdContent=[],createdUsers=[];
  try{
    const upload=await json(await contributorContext.request.post('/api/contributor/upload',{data:{data:jpeg}}));
    const makePayload=title=>({action:'draft',type:'article',category:'Innovation',title,excerpt,body,coverUrl:upload.url,sources:[{label:'Page de test IANA',url:'https://www.iana.org/help/example-domains',publisher:'IANA'}]});

    const rejectedDraft=await json(await contributorContext.request.post('/api/contributor/submissions',{data:makePayload(`TEST TECHNIQUE refus ${Date.now()}`)}));createdSubmissions.push(rejectedDraft.id);
    expect((await contributorContext.request.post('/api/contributor/submissions',{data:{...makePayload('x'),id:rejectedDraft.id,action:'submit'}})).status()).toBe(400);
    await json(await contributorContext.request.post('/api/contributor/submissions',{data:{...makePayload(`TEST TECHNIQUE refus ${Date.now()}`),id:rejectedDraft.id,action:'submit'}}));
    expect((await contributorContext.request.post('/api/contributor/submissions',{data:{...makePayload('TEST TECHNIQUE modification interdite'),id:rejectedDraft.id}})).status()).toBe(409);
    await json(await adminContext.request.post('/api/admin/submissions',{data:{id:rejectedDraft.id,action:'reject',reason:'Refus de recette contrôlé : contenu volontairement non éditorial.'}}));
    const rejected=await json(await contributorContext.request.get(`/api/contributor/submissions?id=${rejectedDraft.id}`));expect(rejected.item.review_reason).toContain('recette contrôlé');

    const approvedDraft=await json(await contributorContext.request.post('/api/contributor/submissions',{data:makePayload(`TEST TECHNIQUE publication ${Date.now()}`)}));createdSubmissions.push(approvedDraft.id);
    await json(await contributorContext.request.post('/api/contributor/submissions',{data:{...makePayload(`TEST TECHNIQUE publication ${Date.now()}`),id:approvedDraft.id,action:'submit'}}));
    const approved=await json(await adminContext.request.post('/api/admin/submissions',{data:{id:approvedDraft.id,action:'approve'}}));createdContent.push(approved.contentId);
    const publicPage=await contributorContext.request.get(`/fr/articles/${approved.slug}/`);expect(publicPage.status()).toBe(200);expect(await publicPage.text()).toContain('TEST TECHNIQUE');

    const tempEmail=`aetbconseil+tamusni-recette-${Date.now()}@gmail.com`,tempPassword='test123';
    const createdUser=await json(await adminContext.request.post('/api/admin/users',{data:{name:'Recette Isolement',email:tempEmail,password:tempPassword,preferredTopic:'Innovation',role:'USER'}}));createdUsers.push(createdUser.id);
    await json(await adminContext.request.patch('/api/admin/users',{data:{id:createdUser.id,role:'CONTRIBUTOR'}}));
    await json(await adminContext.request.patch('/api/admin/users',{data:{id:createdUser.id,action:'password',password:'test456'}}));
    const secondContext=await browser.newContext({baseURL:process.env.TAMUSNI_TEST_URL||'http://127.0.0.1:8788'}),secondPage=await secondContext.newPage();await login(secondPage,{email:tempEmail,password:'test456'});
    expect((await secondContext.request.get(`/api/contributor/submissions?id=${rejectedDraft.id}`)).status()).toBe(404);await secondContext.close();

    const overview=await json(await adminContext.request.get('/api/admin/overview'));expect(overview.audit.some(entry=>String(entry.action).startsWith('submission.'))).toBe(true);
  }finally{
    for(const id of createdContent)await adminContext.request.delete('/api/admin/content',{data:{id}});
    for(const id of createdSubmissions)await adminContext.request.delete('/api/admin/submissions',{data:{id}});
    for(const id of createdUsers)await adminContext.request.delete('/api/admin/users',{data:{id}});
    await contributorContext.close();await adminContext.close();
  }
});

test('registered user interactions feed real analytics',async({page})=>{
  test.skip(!user.email||!user.password,'User credentials are required');
  await login(page,user);
  await page.goto('/fr/');
  const newsletter=await page.request.post('/api/newsletter',{data:{email:user.email,locale:'fr',company:''}});
  expect([200,201]).toContain(newsletter.status());
  expect((await newsletter.json()).ok).toBe(true);
  const article=page.locator('a[href*="/fr/articles/"]').first();await expect(article).toBeVisible();await article.click();
  await expect(page.locator('.article-page')).toBeVisible();
  await page.locator('.like-action').click();await expect(page.locator('.like-action')).toHaveAttribute('aria-pressed',/true|false/);
  await page.locator('.save-action').click();await expect(page.locator('.save-action')).toHaveAttribute('aria-pressed','true');
  await page.goto('/fr/mon-espace/');await expect(page.locator('main')).toContainText(/Favoris|Historique/);
});
