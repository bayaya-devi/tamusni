# Sécurité des comptes TAMUSNI

La sécurité reste une couche additive au système de comptes Cloudflare D1 / Supabase existant.

## Parcours protégés

- Inscription classique : compte non vérifié, code e-mail à six chiffres, expiration après 10 minutes, cinq essais maximum et renvoi après 60 secondes.
- Google OAuth : l’adresse confirmée par Supabase est considérée comme vérifiée ; aucun second code n’est demandé.
- Mot de passe oublié : réponse neutre, lien aléatoire à usage unique valable 30 minutes.
- Changement ou réinitialisation du mot de passe : incrément de `users.session_version`, ce qui révoque les autres cookies de session.
- Suppression : mot de passe et avertissement explicite, puis code `ACCOUNT_DELETION`; le rôle `ADMIN` ne peut pas se supprimer depuis l’interface.
- Les codes et jetons ne sont jamais stockés en clair.

## Cloudflare Turnstile

Le frontend lit uniquement `TURNSTILE_SITE_KEY`. Le backend valide le jeton avec `TURNSTILE_SECRET_KEY` auprès de Cloudflare.

1. Créer un widget Turnstile pour `tamusni.pages.dev` dans Cloudflare.
2. Ajouter `TURNSTILE_SITE_KEY` comme variable Pages.
3. Ajouter `TURNSTILE_SECRET_KEY` comme secret Pages.
4. Après vérification du widget en production, définir `TURNSTILE_REQUIRED=true`.

Si `TURNSTILE_REQUIRED=true` et que le secret manque, les opérations protégées échouent sans créer de compte. Ne jamais placer le secret dans le frontend ou dans Git.

## Migration

`migrations/0028_account_security.sql` ajoute `session_version`, les défis ponctuels et les limites progressives. Les anciens liens de confirmation déjà envoyés restent acceptés pendant leur durée de validité.

