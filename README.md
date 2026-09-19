# TAMUSNI

Revue technologique internationale : Technologies • Sciences • Futur.

## Inclus

- Homepage éditoriale responsive et pages de rubriques, formats et articles.
- Comptes gratuits facultatifs, session sécurisée et rôles `USER` / `ADMIN` avec une page de connexion commune.
- E-mails d’accueil utilisateur et notification d’inscription à `aetbconseil@gmail.com` via Resend.
- Mode clair/sombre : préférence de l’appareil par défaut, choix manuel mémorisé.
- Emplacements publicitaires propres : colonne de Une, milieu de page et article, fin d’article. Ils sont inactifs par défaut.
- Migration Cloudflare D1 pour utilisateurs, newsletter, articles sauvegardés et emplacements publicitaires.

## Préparation locale

Copier `.env.example` vers `.env.local`, définir une vraie valeur `AUTH_SECRET`, puis :

```bash
npm install
npm run dev
```

Pour le compte administrateur local, utiliser `ADMIN_EMAIL` et `ADMIN_PASSWORD` définis dans `.env.local`.

## Cloudflare + Resend

1. Créer la base : `npx wrangler d1 create tamusni-production`.
2. Remplacer `REPLACE_AFTER_WRANGLER_D1_CREATE` dans `wrangler.jsonc` par l’identifiant retourné.
3. Appliquer la migration : `npx wrangler d1 migrations apply tamusni-production --remote`.
4. Ajouter dans les secrets Cloudflare : `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `RESEND_API_KEY` et `RESEND_FROM`.
5. Vérifier le domaine expéditeur dans Resend. Le domaine est indispensable pour envoyer au-delà du destinataire de test Resend.

Ne jamais versionner les secrets.
