# TAMUSNI — guide d’exploitation de production

Ce document décrit les opérations courantes sans contenir de secret. La production publique est servie par Cloudflare Pages depuis `Site web/`; les Pages Functions utilisent D1. Le Worker `editorial-automation/` gère la veille et la publication planifiée. Supabase fournit l’authentification sociale et le miroir des données de compte. Brevo assure les e-mails.

## Contrôles quotidiens

1. Ouvrir `https://tamusni.pages.dev/fr/` et un article récent en FR, EN et AR.
2. Vérifier `https://tamusni.pages.dev/api/backend-status` : Cloudflare/D1 et Supabase doivent être disponibles.
3. Vérifier `/health` sur le Worker éditorial, puis l'état actif du workflow GitHub `TAMUSNI weekly newsletter`.
4. Examiner les erreurs récentes dans les journaux Cloudflare Pages et Worker, sans copier de données personnelles dans un ticket.
5. Contrôler dans D1 le dernier `editorial_runs` et ses `editorial_logs` avant toute relance.

## Installation et validation locale

Depuis la racine du dépôt :

```powershell
npm install
npm test
npm run typecheck
npm run lint
npm run build
node 'node_modules/wrangler/bin/wrangler.js' pages dev 'Site web' --port 8788
```

Le lint Next ignore uniquement sa règle de navigation interne dans `Site web/`, car ces scripts statiques sont servis directement par Cloudflare Pages et n’utilisent pas le routeur Next.js. Toutes les autres règles ESLint restent actives. Les secrets se configurent dans Cloudflare ou `.env.local`, jamais dans Git.

## Déploiement

```powershell
node 'node_modules/wrangler/bin/wrangler.js' d1 migrations apply tamusni-production --remote
node 'node_modules/wrangler/bin/wrangler.js' pages deploy 'Site web' --project-name tamusni --branch master
node 'node_modules/wrangler/bin/wrangler.js' deploy --config 'editorial-automation/wrangler.jsonc'
```

Après déploiement, noter le SHA Git et l’identifiant Cloudflare, puis exécuter les tests E2E contre `https://tamusni.pages.dev`. Un déploiement de prévisualisation ne remplace pas le contrôle du domaine principal.

## Publication automatisée

Le Cron technique s’exécute toutes les quinze minutes. D1 conserve l’alternance de deux jours calendaires et l’heure légale `Africa/Casablanca`; il ne faut donc pas remplacer cette logique par un simple « tous les deux jours » dans Cron. La préparation démarre le jour dû, puis la publication est autorisée à 06:00 locale.

Avant publication, le pipeline impose : sources HTTPS relues, absence de doublon, score éditorial 5×10, fiche factuelle, FR/EN/AR complets, image, contrôle qualité indépendant et contrôle SEO/GEO. Une rubrique sans sujet fiable est reportée et reste dans le cycle.

## Comprendre et reprendre un échec

1. Lire `editorial_runs.status`, `error_code`, `error_detail` et les lignes `editorial_logs` du même `run_id`.
2. Vérifier l’état des sources dans `editorial_source_feeds.last_status`.
3. Corriger la cause avant toute relance : source, secret, quota, traduction, image ou contrôle public.
4. Utiliser la route Worker protégée `/run?mode=prepare&force=1` ou `/run?mode=publish&force=1` uniquement avec `EDITORIAL_RUN_TOKEN` et après contrôle de l’état D1.
5. Ne jamais supprimer une ligne pour contourner l’idempotence. La contrainte `(local_date, purpose)` et l’état `scheduled` empêchent normalement un doublon.

Une relance forcée est une opération d’exploitation, pas un outil de création artificielle. Si les sources sont insuffisantes, conserver `no_topic`.

## Correction ou retrait éditorial

- Corriger depuis l’administration afin de conserver une révision et le journal d’audit.
- Pour retirer un contenu sans effacer son historique, utiliser `archived` plutôt qu’une suppression définitive.
- Une correction factuelle importante doit être décrite dans le contenu conformément à la politique de corrections.
- Après modification, vérifier les trois langues, les sources, les métadonnées et l’URL publique.

## Sauvegarde et restauration D1

Cloudflare D1 Time Travel fournit des signets de restauration. Avant une opération sensible :

```powershell
node 'node_modules/wrangler/bin/wrangler.js' d1 time-travel info tamusni-production --remote
```

Conserver le signet retourné dans le journal d’intervention. Pour restaurer, utiliser la commande `d1 time-travel restore` indiquée par Wrangler avec le signet exact. Une restauration est destructive pour l’état postérieur : elle exige une décision humaine, une fenêtre d’intervention et un contrôle préalable des données. Ne jamais la tester directement en production.

## Retour arrière d’un déploiement

- Pages : sélectionner dans Cloudflare Pages le dernier déploiement de production sain et utiliser la fonction de rollback, ou redéployer explicitement le commit sain.
- Worker : redéployer le commit sain avec son `wrangler.jsonc`; ne pas modifier le cycle D1 pendant le rollback.
- Après rollback : contrôler `/health`, `/api/backend-status`, la page d’accueil, un article FR/EN/AR et les routes privées.

## Newsletter Brevo

Le workflow GitHub `weekly-newsletter.yml` possède une planification indépendante et un verrou de concurrence. Il s'exécute le dimanche à 08:00, heure de Casablanca. Le test manuel reste par défaut en mode `force=1&dryRun=1`, sans envoi. Ne jamais désactiver `dry_run` lors d'un test. Contrôler l'expéditeur actif, le webhook, les listes et les états D1 avant un lancement réel.

## Alertes et confidentialité

Cloudflare Observability conserve les logs Pages/Worker. L’administration expose les notifications et l’historique d’actions. Aucun secret, mot de passe, jeton ou contenu complet d’e-mail ne doit être inscrit dans un log. Le projet ne dispose pas encore d’une astreinte externe garantie : une alerte Cloudflare/Brevo et un destinataire opérationnel doivent être configurés avant une exigence de disponibilité 24/7.

## Services, limites et coûts

- Cloudflare Pages/Functions/D1/Workers AI : hébergement, API, base et génération. Quotas et éventuels coûts dépendent du forfait et de la consommation Workers AI/D1.
- Supabase : OAuth et miroir. Une panne n’efface pas D1, mais peut bloquer Google OAuth et la synchronisation.
- Brevo : transactionnel et newsletter. Les limites d’envoi et coûts dépendent du forfait et de la réputation d’expéditeur.
- Google OAuth : fournisseur social ; dépend du client OAuth, de l’URI Supabase exacte et de la validation du consentement.
- Google AdSense : vérification du domaine seulement pour l’instant ; les emplacements et scripts d’annonce restent désactivés tant que `ADS_ENABLED` n’est pas explicitement activé après acceptation.

Consulter les tableaux de bord fournisseurs avant toute hausse de volume ; ne jamais activer une offre payante sans autorisation.

## Procédure d’urgence

1. Si le site public est compromis, suspendre le Worker éditorial et revenir au dernier déploiement sain.
2. Révoquer immédiatement tout secret suspect dans le fournisseur concerné, puis remplacer le secret Cloudflare.
3. Conserver les logs et le signet D1 ; ne pas effacer les preuves.
4. Vérifier les comptes administrateurs, sessions, journaux d’audit et publications récentes.
5. Restaurer uniquement après avoir identifié la fenêtre affectée.
6. Tester le domaine principal avant de réactiver le Cron.
