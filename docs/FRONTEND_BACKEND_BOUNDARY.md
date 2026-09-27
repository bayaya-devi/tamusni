# Frontend / backend : frontière TAMUSNI

## Frontend public

`Site web/` contient uniquement les pages HTML, styles, images et scripts exécutés dans le navigateur. Aucun secret, accès D1, clé Supabase de service ou règle métier sensible ne doit y être ajouté.

Les scripts client utilisent `window.TamusniApi.request()` depuis `Site web/api-client.js`. Cette passerelle n'autorise que les URL même-origine commençant par `/api/` et envoie les cookies de session uniquement au domaine TAMUSNI.

## Backend privé

`functions/` contient exclusivement les Pages Functions Cloudflare :

- `functions/api/` : contrat HTTP public ;
- `functions/api/admin/` : opérations réservées aux administrateurs ;
- `functions/_lib/` : authentification, validation, session et intégrations serveur ;
- D1 et Supabase : accessibles seulement au runtime Cloudflare via des secrets/bindings.

Le middleware `functions/api/_middleware.js` impose la même origine pour les écritures, désactive le cache des réponses d'API et ajoute les protections de type MIME et de ressources croisées.

## Contrat d'évolution

1. Une nouvelle fonctionnalité débute par une route `/api/...` documentée, avec validation et autorisation côté Function.
2. Le frontend ne contient que l'affichage et l'appel via `TamusniApi`.
3. Les clés Cloudflare, Resend et Supabase `service_role` ne sont configurées que comme secrets Cloudflare.
4. La source de vérité de chaque donnée est déclarée dans `BACKEND_ARCHITECTURE.md` avant toute réplication.
