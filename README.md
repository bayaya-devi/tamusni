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
5. Ajouter dans les secrets Cloudflare : `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `BREVO_WEBHOOK_SECRET`, `NEWSLETTER_RUN_TOKEN` et `TURNSTILE_SECRET_KEY`. Ajouter `TURNSTILE_SITE_KEY` comme variable publique Pages.
6. Activer `OAUTH_GOOGLE_ENABLED=true` après configuration du fournisseur Google dans Supabase Auth.
7. Vérifier l’expéditeur et, idéalement, le domaine d’envoi dans Brevo avant tout envoi réel.

La répartition détaillée et les règles de continuité sont décrites dans [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md).
La frontière stricte entre l'interface publique et l'API est documentée dans [`docs/FRONTEND_BACKEND_BOUNDARY.md`](docs/FRONTEND_BACKEND_BOUNDARY.md).
Le mécanisme de désactivation et de réactivation future des annonces est documenté dans [`docs/ADSENSE_READINESS.md`](docs/ADSENSE_READINESS.md).
Les procédures de production, sauvegarde, restauration, reprise et retour arrière sont centralisées dans [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md).
La vérification e-mail, la révocation des sessions, la suppression sécurisée et Turnstile sont décrits dans [`docs/ACCOUNT_SECURITY.md`](docs/ACCOUNT_SECURITY.md).
La maintenance hebdomadaire GitHub Actions, ses tests, son rapport PDF et son envoi Brevo sont décrits dans [`docs/WEEKLY_MAINTENANCE.md`](docs/WEEKLY_MAINTENANCE.md).

## Newsletter hebdomadaire

La newsletter ne possède pas de formulaire public : seul un compte TAMUSNI peut activer la préférence **« Recevoir la newsletter TAMUSNI »** depuis *Mon espace*. D1 (`newsletter_subscribers`) est la source de vérité ; Brevo est synchronisé après chaque changement et une désinscription reste effective dans D1 même si la synchronisation externe doit être réessayée.

Le workflow GitHub Actions est un simple déclencheur de réveil toutes les quinze minutes. Le job durable `weekly_newsletter` dans D1 décide de l’exécution : il planifie l’édition le dimanche à 06:00 dans le fuseau `Africa/Casablanca`, calcule la période du lundi 00:00 local jusqu’à cette échéance, conserve les échecs réversibles en attente et utilise une clé d’édition stable par semaine et par langue. Les campagnes Brevo créées sont enregistrées avant l’envoi ; un retry consulte cette campagne au lieu de recréer un envoi déjà accepté par Brevo.

Pour un contrôle sans diffusion, lancer le workflow **TAMUSNI weekly newsletter** avec `dry_run=true`. Le mode de test autorisé envoie uniquement les deux messages de contrôle à `aetbconseil@gmail.com` lorsque l’option dédiée est explicitement activée.

Ne jamais versionner les secrets.
