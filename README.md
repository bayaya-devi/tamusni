# TAMUSNI

Revue technologique internationale : Technologies • Sciences • Futur.

## Inclus

- Homepage éditoriale responsive et pages de rubriques, formats et articles.
- Comptes gratuits facultatifs, session sécurisée et rôles `USER` / `ADMIN` avec une page de connexion commune.
- E-mails d’accueil utilisateur et notification d’inscription à `aetbconseil@gmail.com` via Resend.
- Mode clair/sombre : préférence de l’appareil par défaut, choix manuel mémorisé.
- Emplacements publicitaires propres : colonne de Une, milieu de page et article, fin d’article. Ils sont inactifs par défaut.
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

## Cloudflare + Supabase + Resend

1. Créer la base : `npx wrangler d1 create tamusni-production`.
2. Remplacer `REPLACE_AFTER_WRANGLER_D1_CREATE` dans `wrangler.jsonc` par l’identifiant retourné.
3. Appliquer la migration : `npx wrangler d1 migrations apply tamusni-production --remote`.
4. Appliquer `supabase/migrations/20260924123000_tamusni_schema.sql` au projet Supabase.
5. Ajouter dans les secrets Cloudflare : `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` et `RESEND_FROM`.
6. Activer `OAUTH_GOOGLE_ENABLED=true` après configuration du fournisseur Google dans Supabase Auth.
7. Vérifier le domaine expéditeur dans Resend. Le domaine est indispensable pour envoyer au-delà du destinataire de test Resend.

La répartition détaillée et les règles de continuité sont décrites dans [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md).

Ne jamais versionner les secrets.
