# Architecture backend hybride TAMUSNI

TAMUSNI utilise Cloudflare et Supabase ensemble. Les deux services ont des responsabilités complémentaires ; les requêtes ne sont pas inutilement dupliquées entre deux bases lorsque cela augmenterait la latence ou les risques d’incohérence.

## Cloudflare

- Pages héberge le site public.
- Pages Functions exécute les API côté serveur.
- D1 est la base opérationnelle des contenus, réglages éditoriaux, commentaires, vues, likes, publicités et données nécessaires à l’administration.
- Les protections Cloudflare filtrent et limitent le trafic avant l’exécution des API.

## Supabase

- Supabase Auth gère les fournisseurs sociaux, notamment Google OAuth.
- PostgreSQL conserve un miroir serveur des comptes TAMUSNI, abonnements newsletter et favoris.
- La clé `service_role` reste exclusivement dans les secrets Cloudflare et n’est jamais envoyée au navigateur.
- Les politiques RLS restent activées sur les tables exposées par l’API Supabase.

## Règles de fonctionnement

1. Le navigateur appelle uniquement les API TAMUSNI ou Supabase Auth avec la clé publique anonyme.
2. Les opérations privilégiées vers Supabase partent des Functions Cloudflare.
3. D1 sert les lectures éditoriales sensibles à la latence et reste disponible si un miroir Supabase temporairement indisponible doit être resynchronisé.
4. Les erreurs de miroir sont journalisées sans interrompre l’action principale de l’utilisateur.
5. `/api/backend-status` contrôle indépendamment D1 et Supabase.
6. Toute nouvelle fonctionnalité backend doit préciser avant développement où se trouve sa source de vérité et quelles données doivent être répliquées.

Cette séparation évite deux écritures concurrentes faisant autorité sur la même donnée, tout en utilisant réellement Cloudflare et Supabase dans le backend commercial.
