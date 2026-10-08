# TAMUSNI

Revue technologique internationale : Technologies • Sciences • Futur.

## Inclus

- Homepage éditoriale responsive et pages de rubriques, formats et articles.
- Comptes gratuits facultatifs, session sécurisée et rôles `USER` / `ADMIN` avec une page de connexion commune.
- E-mails transactionnels et newsletter via Brevo, avec consentement et désinscription conservés dans D1.
- Frontend public localisé en français, arabe, anglais, espagnol et portugais ; thème clair/sombre suivant l’appareil.
- Architecture publicitaire conservée mais entièrement inactive par défaut : aucun emplacement ni script publicitaire n’est rendu tant que `ADS_ENABLED=true` n’est pas défini après approbation.
- Backend hybride Cloudflare + Supabase, surveillé par `/api/backend-status`.
- Cloudflare Pages Functions et D1 pour l’exécution, les contenus, l’administration et les compteurs à faible latence.
- Supabase Auth pour Google OAuth et miroir durable des comptes, abonnements newsletter et favoris.

## Préparation locale

Copier `.env.example` vers `.env.local`, définir une vraie valeur `AUTH_SECRET`, puis :

```bash
npm install
npm run dev
```

Pour le compte administrateur local, utiliser `ADMIN_EMAIL` et `ADMIN_PASSWORD` définis dans `.env.local`.

Le site actuellement publié sur Cloudflare Pages est servi depuis `Site web` avec les fonctions dans `functions/` ; le projet Next.js `src/app` est distinct et n’est pas le pipeline de production. Sous PowerShell, le chemin du dépôt contient `&` : lancez les exécutables Node directement depuis le dépôt, par exemple :

```powershell
node 'node_modules/wrangler/bin/wrangler.js' d1 migrations apply tamusni-production --local
node 'node_modules/wrangler/bin/wrangler.js' pages dev 'Site web' --port 8788
node 'node_modules/@playwright/test/cli.js' test --config=playwright.config.mjs
```

La refonte publique est décrite dans [`docs/frontend-constitution.md`](docs/frontend-constitution.md), [`docs/frontend-i18n.md`](docs/frontend-i18n.md) et [`docs/frontend-components.md`](docs/frontend-components.md). Le premier rendu des traductions historiques ES/PT peut demander du temps ; les visites suivantes lisent les versions mises en cache dans D1.

## Cloudflare + Supabase + Brevo

1. Créer la base : `npx wrangler d1 create tamusni-production`.
2. Remplacer `REPLACE_AFTER_WRANGLER_D1_CREATE` dans `wrangler.jsonc` par l’identifiant retourné.
3. Appliquer la migration : `npx wrangler d1 migrations apply tamusni-production --remote`.
4. Appliquer `supabase/migrations/20260924123000_tamusni_schema.sql` au projet Supabase.
5. Ajouter dans les secrets Cloudflare : `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `BREVO_WEBHOOK_SECRET` et `NEWSLETTER_RUN_TOKEN`.
6. Activer `OAUTH_GOOGLE_ENABLED=true` après configuration du fournisseur Google dans Supabase Auth.
7. Vérifier l’expéditeur et, idéalement, le domaine d’envoi dans Brevo avant tout envoi réel.

La répartition détaillée et les règles de continuité sont décrites dans [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md).
La frontière stricte entre l'interface publique et l'API est documentée dans [`docs/FRONTEND_BACKEND_BOUNDARY.md`](docs/FRONTEND_BACKEND_BOUNDARY.md).
Le mécanisme de désactivation et de réactivation future des annonces est documenté dans [`docs/ADSENSE_READINESS.md`](docs/ADSENSE_READINESS.md).
Les procédures de production, sauvegarde, restauration, reprise et retour arrière sont centralisées dans [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md).
La maintenance hebdomadaire GitHub Actions, ses tests, son rapport PDF et son envoi Brevo sont décrits dans [`docs/WEEKLY_MAINTENANCE.md`](docs/WEEKLY_MAINTENANCE.md).

Ne jamais versionner les secrets.
